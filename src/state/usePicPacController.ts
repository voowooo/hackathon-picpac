import type { AnchorsEvent, ArViewHandle, ProjectionEvent, TapEvent } from "@stewmore/expo-ar";
import * as ImagePicker from "expo-image-picker";
import { router, usePathname } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, LayoutAnimation, PanResponder, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { applyRemoteCatalog, COVER_URLS, DELIVERY_OPTIONS, INITIAL_ORDERS, MIN_SPREADS, ORDER_STATUSES, POSTER_SIZES, PRODUCT_TABS, PROMO_CODE, PROMO_DISCOUNT, SPREAD_LAYOUTS, STATUS_ICONS } from '../config/catalog';
import { ApiError, createOrder, fetchCatalog, fetchOrders, uploadOrderPhotos, validatePromo } from '../services/api';
import { SCREEN_DEPTH, SCREEN_PATHS, screenFromPath } from "../config/navigation";
import { exifLocation, exifTimestamp, geoDistance, makePhotoId } from '../domain/photos';
import { aiSurcharge, baseEstimate, filledCount, getPrintFinish, lowResCount, makeConfig, normalizeLayouts, pageOfSlotId, productDetails, productTitle, slotPhotoInfo, slotPrintFinish, spreadSlotsFor, syncSlots } from '../domain/products';
import { AR_POSTER_HEIGHT_M } from '../services/ar';
import { DRAFTS_KEY, storage } from '../services/storage';
import { Draft, DropRect, IconName, MockOrder, Panel, Photo, PhotoEdit, PhotoProcessingUpdate, PhotoSlot, ProductCategory, ProductConfig, Screen, ViewRef } from '../types/index';
import { analyzePhoto } from '../features/smart-tools/service';
import { parseHexColor } from '../utils/format';
import { makeSmartLayout } from '../features/smart-tools/layout';

export function usePicPacController() {

  const insets = useSafeAreaInsets();

  const { width } = useWindowDimensions();

  const screen = screenFromPath(usePathname());
  const setScreen = useCallback((next: Screen) => router.navigate(SCREEN_PATHS[next]), []);

  const prevScreen = useRef<Screen>("home");

  const slideDir = useRef<1 | -1>(1);

  if (prevScreen.current !== screen) {
    slideDir.current = SCREEN_DEPTH[screen] >= SCREEN_DEPTH[prevScreen.current] ? 1 : -1;
    prevScreen.current = screen;
  }

  const photosRef = useRef<Photo[]>([]);

  const [photos, setPhotosState] = useState<Photo[]>([]);

  const [scenarioTitle, setScenarioTitle] = useState<string | undefined>();

  const [chooseProductAfterUpload, setChooseProductAfterUpload] = useState(false);

  const [cfg, setCfg] = useState<ProductConfig>(() => makeConfig("print", []));

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const [swapSlotId, setSwapSlotId] = useState<string | null>(null);

  const [bookPage, setBookPage] = useState(0);

  const [checkoutPreviewOpen, setCheckoutPreviewOpen] = useState(false);

  const [editorPanel, setEditorPanelState] = useState<Panel | null>(null);

  // AR-примерка постера (только для категории «poster»).
  const [arOpen, setArOpen] = useState(false);

  // Настоящий AR через expo-ar: якорь-центр постера + три якоря-«линейки»
  // на 1 м по осям плоскости (по их проекциям считаем масштаб экрана).
  const arRef = useRef<ArViewHandle | null>(null);

  const [arPhase, setArPhase] = useState<"searching" | "placed">("searching");

  const [arTracking, setArTracking] = useState<"initializing" | "limited" | "normal" | "unavailable">("initializing");

  const [arNotice, setArNotice] = useState<string | null>(null);

  const arAnchors = useRef<{ center: string | null; refX: string | null; refY: string | null; refZ: string | null; pending: string | null }>({
    center: null, refX: null, refY: null, refZ: null, pending: null,
  });

  const arTransforms = useRef(new Map<string, number[]>());

  const arUserScale = useRef(1);

  const arPinchInfo = useRef({ base: 1, dist: 0 });

  // Позиция и размер постера — в анимационных значениях: проекции приходят
  // каждый кадр, дерево ре-рендерить нельзя.
  const arPosterPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const arPosterSize = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const clearArAnchors = () => {
    const ids = [arAnchors.current.center, arAnchors.current.refX, arAnchors.current.refY, arAnchors.current.refZ]
      .filter(Boolean) as string[];
    ids.forEach((id) => void arRef.current?.removeAnchor(id));
    arAnchors.current = { center: null, refX: null, refY: null, refZ: null, pending: null };
    arUserScale.current = 1;
    arPosterSize.setValue({ x: 0, y: 0 });
    setArPhase("searching");
  };

  // Тап по AR-виду: снять старый постер (если был) и добавить якорь в точке тапа.
  const handleArTap = async (e: { nativeEvent: TapEvent }) => {
    const view = arRef.current;
    if (!view || arAnchors.current.pending) return;
    if (arAnchors.current.center) clearArAnchors();
    setArNotice(null);
    const anchor = await view.addAnchor(e.nativeEvent.x, e.nativeEvent.y);
    if (!anchor) {
      setArNotice("Поверхность не распознана — наведите камеру на стену при хорошем свете");
      return;
    }
    arAnchors.current.pending = anchor.id;
  };

  // Якоря приходят с трансформами: по центру создаём три якоря-«линейки» на 1 м
  // по каждой оси трансформа (какая ось лежит в стене — зависит от платформы).
  const handleArAnchors = (e: { nativeEvent: AnchorsEvent }) => {
    const view = arRef.current;
    const st = arAnchors.current;
    for (const a of e.nativeEvent.anchors) arTransforms.current.set(a.id, a.transform);
    if (!view || !st.pending || st.center || !arTransforms.current.has(st.pending)) return;
    const t = arTransforms.current.get(st.pending) as number[];
    // Якорь-линейка: копия трансформа центра, сдвинутая на 1 м по оси axisIdx.
    const makeRuler = (axisIdx: number): number[] => {
      const m = [...t];
      m[12] = t[12] + t[axisIdx * 4];
      m[13] = t[13] + t[axisIdx * 4 + 1];
      m[14] = t[14] + t[axisIdx * 4 + 2];
      return m;
    };
    st.center = st.pending;
    st.pending = null;
    void view.addAnchorAtWorld?.(makeRuler(0))?.then((a) => { if (a) st.refX = a.id; });
    void view.addAnchorAtWorld?.(makeRuler(1))?.then((a) => { if (a) st.refY = a.id; });
    void view.addAnchorAtWorld?.(makeRuler(2))?.then((a) => { if (a) st.refZ = a.id; });
  };

  // Проекции каждый кадр: центр постера — проекция якоря-центра, масштаб —
  // экранная длина метрового сегмента (берём ось, у которой проекция шире).
  const handleArProjection = (e: { nativeEvent: ProjectionEvent }) => {
    const st = arAnchors.current;
    if (!st.center) return;
    const pts = e.nativeEvent.points;
    const c = pts.find((p) => p.id === st.center);
    if (!c || !c.inFront) { arPosterSize.setValue({ x: 0, y: 0 }); return; }
    let pxPerM = 0;
    for (const rid of [st.refX, st.refY, st.refZ]) {
      if (!rid) continue;
      const r = pts.find((p) => p.id === rid);
      if (r && r.inFront) pxPerM = Math.max(pxPerM, Math.hypot(r.x - c.x, r.y - c.y));
    }
    if (pxPerM < 8) { arPosterSize.setValue({ x: 0, y: 0 }); return; }
    const h = AR_POSTER_HEIGHT_M * pxPerM * arUserScale.current;
    const w = h * posterAspect;
    arPosterPos.setValue({ x: c.x - w / 2, y: c.y - h / 2 });
    arPosterSize.setValue({ x: w, y: h });
    setArPhase((p) => (p === "placed" ? p : "placed"));
  };

  // Щипок двумя пальцами — физический размер постера (обновится со следующей проекцией).
  const arPinchResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) => e.nativeEvent.touches.length >= 2,
      onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length >= 2,
      onPanResponderGrant: (e) => {
        const t = e.nativeEvent.touches;
        arPinchInfo.current = {
          base: arUserScale.current,
          dist: t.length >= 2 ? Math.hypot(t[1].pageX - t[0].pageX, t[1].pageY - t[0].pageY) : 0,
        };
      },
      onPanResponderMove: (e) => {
        const t = e.nativeEvent.touches;
        const g = arPinchInfo.current;
        if (t.length < 2 || g.dist <= 0) return;
        const d = Math.hypot(t[1].pageX - t[0].pageX, t[1].pageY - t[0].pageY);
        arUserScale.current = Math.min(5, Math.max(0.2, g.base * (d / g.dist)));
      },
    }),
  ).current;

  const [panelContent, setPanelContent] = useState<Panel>("products");

  const setEditorPanel = useCallback((panel: Panel | null) => {
    if (panel) setPanelContent(panel);
    setEditorPanelState(panel);
  }, []);

  const [textEditing, setTextEditing] = useState<"postcardCaption" | "bookTitle" | null>(null);

  const [textDraft, setTextDraft] = useState("");

  const [textField, setTextField] = useState<"postcardCaption" | "bookTitle">("postcardCaption");

  // Ручной ввод цвета (#RRGGBB) для названия/рамки обложки: target = чья палитра открыта.
  const [hexTarget, setHexTarget] = useState<"title" | "frame" | null>(null);

  const [hexValue, setHexValue] = useState("");

  const hexValid = parseHexColor(hexValue) !== null;

  const pickingPhoto = useRef(false);

  const openTextEditor = (field: "postcardCaption" | "bookTitle") => {
    setPostcardInteracting(false);
    setTextDraft(cfg[field]);
    setTextField(field);
    setTextEditing(field);
  };

  const [orders, setOrders] = useState<MockOrder[]>(INITIAL_ORDERS);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [deliveryId, setDeliveryId] = useState("courier");

  const [paymentId, setPaymentId] = useState("card");

  const [promo, setPromo] = useState("");

  const [recipient, setRecipient] = useState({ name: "", phone: "", address: "" });

  // ——— Сервер PicPac (server/). Пока он не ответил, работаем на локальных моках. ———
  const [apiOnline, setApiOnline] = useState(false);

  const [catalogVersion, setCatalogVersion] = useState(0);

  const [placingOrder, setPlacingOrder] = useState(false);

  const [toast, setToast] = useState<{ id: number; text: string; icon: IconName } | null>(null);

  const showToast = useCallback((text: string, icon: IconName = "checkmark-circle") => setToast({ id: Date.now(), text, icon }), []);

  // Последние известные статусы заказов: при смене (её делает менеджер в админке) показываем уведомление.
  const knownStatus = useRef<Map<string, string> | null>(null);

  const applyRemoteOrders = useCallback((list: MockOrder[]) => {
    const key = (o: MockOrder) => `${o.statusIndex}|${o.cancelled ? 1 : 0}`;
    const prev = knownStatus.current;
    if (prev) {
      const changed = list.find((o) => prev.has(o.id) && prev.get(o.id) !== key(o));
      if (changed) {
        if (changed.cancelled) showToast(`Заказ ${changed.id} отменён`, "close-circle-outline");
        else showToast(`Заказ ${changed.id}: ${ORDER_STATUSES[changed.statusIndex].toLowerCase()}`, STATUS_ICONS[changed.statusIndex]);
      }
    }
    knownStatus.current = new Map(list.map((o) => [o.id, key(o)]));
    setOrders(list);
  }, [setOrders, showToast]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const catalog = await fetchCatalog();
        if (!alive) return;
        applyRemoteCatalog(catalog);
        setDeliveryId((id) => (DELIVERY_OPTIONS.some((d) => d.id === id) ? id : DELIVERY_OPTIONS[0].id));
        setCatalogVersion((v) => v + 1);
        setApiOnline(true);
        const list = await fetchOrders();
        if (alive) applyRemoteOrders(list);
      } catch {
        // Сервер недоступен — остаёмся на моках из config/catalog.ts.
      }
    })();
    return () => { alive = false; };
  }, [applyRemoteOrders]);

  const [drafts, setDrafts] = useState<Draft[]>([]);

  const visibleDrafts = useMemo(() => drafts.filter((draft) => PRODUCT_TABS.some((product) => product.id === draft.cfg.category)), [drafts]);

  const [draftId, setDraftId] = useState<string | null>(null);

  const [savedSig, setSavedSig] = useState<string | null>(null);

  const draftsLoaded = useRef(false);

  // Редактор фото (поворот/обрезка): открывается из панели действий над выбранным фото.
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);

  const [editorRatio, setEditorRatio] = useState(1);

  const editingPhoto = photos.find((p) => p.id === editingPhotoId) ?? null;

  // Результат правок становится новым uri фото (оригинал храним в originalUri) —
  // поэтому отредактированное фото сразу видно везде: в книге, печати, лотке, AR.
  const applyPhotoEdit = useCallback((photoId: string, uri: string, edit: PhotoEdit, update?: PhotoProcessingUpdate) => {
    setPhotosState((prev) => {
      const next = prev.map((p) => (p.id === photoId ? { ...p, uri, edit, originalUri: p.originalUri ?? p.uri,
        ...(update ? { width: update.width, height: update.height, quality: update.quality,
          processingBaseUri: update.processingBaseUri === undefined ? p.processingBaseUri : update.processingBaseUri ?? undefined } : {}),
      } : p));
      photosRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await storage?.getItem(DRAFTS_KEY);
        if (alive && raw) {
          const list = JSON.parse(raw) as Draft[];
          if (Array.isArray(list)) setDrafts((prev) => (prev.length ? prev : list));
        }
      } catch {
        // Повреждённые данные игнорируем.
      }
      draftsLoaded.current = true;
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!draftsLoaded.current) return;
    storage?.setItem(DRAFTS_KEY, JSON.stringify(drafts)).catch(() => { });
  }, [drafts]);

  const currentSig = useMemo(() => JSON.stringify([cfg, photos.map((p) => p.id)]), [cfg, photos]);

  const isSaved = savedSig === currentSig;

  const setPhotos = (next: Photo[]) => {
    photosRef.current = next;
    setPhotosState(next);
  };

  const animate = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  const saveDraft = () => {
    if (!photos.length) { showToast("Сначала добавьте фото", "alert-circle-outline"); return; }
    const id = draftId ?? `dr-${Date.now()}`;
    const draft: Draft = {
      id, name: scenarioTitle ? `${productTitle(cfg)} · ${scenarioTitle}` : productTitle(cfg),
      savedAt: Date.now(), cfg, photos, scenarioTitle, bookPage,
    };
    setDrafts((prev) => [draft, ...prev.filter((d) => d.id !== id)]);
    setDraftId(id);
    setSavedSig(currentSig);
    showToast("Черновик сохранён", "bookmark");
  };

  const openDraft = (d: Draft) => {
    setPhotos(d.photos);
    setScenarioTitle(d.scenarioTitle);
    setCfg(d.cfg);
    setBookPage(d.bookPage);
    setDraftId(d.id);
    setSavedSig(JSON.stringify([d.cfg, d.photos.map((p) => p.id)]));
    setSelectedSlotId(null);
    setSwapSlotId(null);
    setEditorPanel(null);
    setScreen("builder");
  };

  const deleteDraft = (d: Draft) => {
    Alert.alert("Удалить черновик?", d.name, [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить", style: "destructive",
        onPress: () => {
          setDrafts((prev) => prev.filter((x) => x.id !== d.id));
          if (draftId === d.id) { setDraftId(null); setSavedSig(null); }
          showToast("Черновик удалён", "trash-outline");
        },
      },
    ]);
  };

  const leaveBuilder = () => {
    if (photos.length > 0 && !isSaved) {
      Alert.alert("Сохранить черновик?", "Макет можно будет продолжить позже с главной.", [
        { text: "Отмена", style: "cancel" },
        { text: "Не сохранять", style: "destructive", onPress: () => setScreen("home") },
        { text: "Сохранить", onPress: () => { saveDraft(); setScreen("home"); } },
      ]);
      return;
    }
    setScreen("home");
  };

  // ——— Фото ———
  const [qualityChecking, setQualityChecking] = useState(0);
  const scanQuality = async (picked: Photo[]) => {
    setQualityChecking(n => n + picked.length);
    for (const p of picked) {
      const quality = await analyzePhoto(p);
      setPhotosState(prev => {
        const next = prev.map(current => current.id === p.id && current.uri === p.uri ? { ...current, quality } : current);
        photosRef.current = next; return next;
      });
      setQualityChecking(n => Math.max(0, n - 1));
    }
  };
  const pickAssets = async (multi: boolean): Promise<Photo[]> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Нужен доступ", "Разрешите доступ к галерее, чтобы выбрать фотографии.");
      return [];
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsMultipleSelection: multi, quality: 0.85,
      selectionLimit: multi ? 0 : 1, exif: true,
    });
    if (result.canceled) return [];
    const picked = result.assets.map((a) => ({
      id: makePhotoId(), uri: a.uri, width: a.width, height: a.height,
      // Время съёмки из EXIF — по нему «Разложить автоматически» расставит снимки хронологически.
      timestamp: exifTimestamp(a.exif),
      // Координаты из EXIF — по ним «Разложить по местам» сгруппирует снимки, снятые рядом.
      geo: exifLocation(a.exif),
    }));
    setTimeout(() => void scanQuality(picked), 0);
    return picked;
  };

  const addPhotos = (picked: Photo[]) => {
    if (picked.length === 0) return;
    animate();
    const next = [...photosRef.current, ...picked];
    setPhotos(next);
    setCfg((prev) => ({ ...prev, slots: syncSlots(prev, next) }));
    showToast(`Добавлено фото: ${picked.length}`, "images-outline");
  };

  const pickMore = async () => addPhotos(await pickAssets(true));

  const removePhoto = (id: string) => {
    animate();
    const next = photosRef.current.filter((p) => p.id !== id);
    setPhotos(next);
    setCfg((prev) => ({ ...prev, slots: syncSlots(prev, next) }));
  };

  const clearPhotos = () => {
    setPhotos([]);
    setCfg((prev) => ({ ...prev, slots: syncSlots({ ...prev, slots: [] }, []) }));
    setSelectedSlotId(null);
  };

  // ——— Макет ———
  const goToBuilder = (cat?: ProductCategory) => {
    const list = photosRef.current;
    const category = cat ?? cfg.category;
    setCfg((prev) => (category === prev.category ? { ...prev, slots: syncSlots(prev, list) } : makeConfig(category, list, prev)));
    setSelectedSlotId(null);
    setSwapSlotId(null);
    setBookPage(0);
    setScreen("builder");
  };

  const startFlow = async (category: ProductCategory | null = "print", title?: string) => {
    if (pickingPhoto.current) return;
    pickingPhoto.current = true;
    try {
      const picked = await pickAssets(true);
      if (!picked.length) return;
      setPhotos(picked);
      setScenarioTitle(title);
      setCfg(makeConfig(category ?? "print", picked));
      setChooseProductAfterUpload(category === null);
      setDraftId(null);
      setSavedSig(null);
      setSelectedSlotId(null);
      setSwapSlotId(null);
      setBookPage(0);
      setEditorPanel(null);
      // Фотокнига: после выбора фото показываем экран настройки (размер, бумага, объём).
      setScreen(category === null ? "productPicker" : category === "photobook" ? "bookSetup" : "builder");
    } catch {
      Alert.alert("Фото не загружены", "Попробуйте выбрать снимки ещё раз.");
    } finally {
      pickingPhoto.current = false;
    }
  };

  const chooseUploadedProduct = (category: ProductCategory) => {
    const picked = photos;
    if (!picked.length) return;
    setCfg(makeConfig(category, picked));
    setSelectedSlotId(null);
    setSwapSlotId(null);
    setBookPage(0);
    setScreen(category === "photobook" ? "bookSetup" : "builder");
  };

  const updateCfg = useCallback((patch: Partial<ProductConfig>) => {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      // Число разворотов или сетка страницы меняют состав ячеек — пересобираем слоты.
      if (patch.spreads !== undefined) next.spreadLayouts = normalizeLayouts(next.spreadLayouts, next.spreads);
      if (patch.spreads !== undefined || patch.spreadLayouts !== undefined) next.slots = syncSlots(next, photosRef.current);
      return next;
    });
  }, []);

  // Индивидуальные настройки отпечатка (фотопечать): поля/рамка/размер конкретного фото.
  const updatePrintSlot = useCallback((slotId: string, patch: Partial<Pick<PhotoSlot, "printFinish" | "printFormatId">>) => {
    setCfg((prev) => ({ ...prev, slots: prev.slots.map((s) => (s.id === slotId ? { ...s, ...patch } : s)) }));
  }, []);

  // «Применить ко всем»: настройки выбранного отпечатка становятся общими.
  const applyPrintToAll = useCallback((slotId: string) => {
    setCfg((prev) => {
      const src = prev.slots.find((s) => s.id === slotId);
      if (!src) return prev;
      const finish = slotPrintFinish(prev, src);
      const formatId = src.printFormatId ?? prev.printFormatId;
      return {
        ...prev, printFinish: { ...finish }, printFormatId: formatId,
        slots: prev.slots.map((s) => ({ ...s, printFinish: { ...finish }, printFormatId: formatId })),
      };
    });
  }, []);

  const setSpreadLayout = (page: number, layoutId: string) => {
    const list = [...(cfg.spreadLayouts ?? [])];
    list[page - 1] = layoutId;
    updateCfg({ spreadLayouts: list });
    showToast(`Макет разворота ${page}: ${SPREAD_LAYOUTS.find((l) => l.id === layoutId)?.name}`, "grid-outline");
  };

  const applyLayoutToAll = (layoutId: string) => {
    updateCfg({ spreadLayouts: Array(cfg.spreads).fill(layoutId) });
    showToast("Макет применён ко всем разворотам", "copy-outline");
  };

  // Пуст ли разворот: ни в одной ячейке нет фото.
  const spreadIsEmpty = (page: number) => {
    if (cfg.category !== "photobook" || page < 1 || page > cfg.spreads) return false;
    return spreadSlotsFor(cfg, page).every((s) => !s.photoId);
  };

  // Удаление пустого разворота: убираем его из списка и пересобираем слоты.
  const removeSpread = (page: number) => {
    if (cfg.category !== "photobook") return;
    if (cfg.spreads <= MIN_SPREADS) {
      showToast("Минимум разворотов в книге — 2", "alert-circle-outline");
      return;
    }
    setCfg((prev) => {
      if (prev.category !== "photobook" || prev.spreads <= MIN_SPREADS) return prev;
      const layouts = [...(prev.spreadLayouts ?? [])];
      layouts.splice(page - 1, 1);
      const next = { ...prev, spreads: prev.spreads - 1, spreadLayouts: normalizeLayouts(layouts, prev.spreads - 1) };
      next.slots = syncSlots(next, photosRef.current);
      return next;
    });
    // Остаёмся на соседнем развороте: если удалили текущий или предыдущий — сдвигаемся назад.
    setBookPage((p) => Math.min(Math.max(1, p > page ? p - 1 : p), cfg.spreads - 1));
    setSelectedSlotId((sel) => (sel && pageOfSlotId(sel) === page ? null : sel));
    showToast(`Разворот ${page} удалён`, "trash-outline");
  };

  const switchCategory = (id: ProductCategory) => {
    if (id === cfg.category) return;
    setCfg((prev) => makeConfig(id, photosRef.current, prev));
    setSelectedSlotId(null);
    setSwapSlotId(null);
    setBookPage(0);
  };

  const selectSlot = (id: string | null) => {
    setSelectedSlotId(id);
    // Страницу не листаем автоматически: пользователь сам решает, куда смотреть.
  };

  // Нажатие на ячейку только выбирает её; замена — из ленты фото или кнопкой «Из галереи».
  const handleSlotPress = (slotId: string) => {
    if (swapSlotId && swapSlotId !== slotId) {
      swapSlots(swapSlotId, slotId);
      setSwapSlotId(null);
      selectSlot(slotId);
      showToast("Фото поменяны местами", "swap-horizontal-outline");
      return;
    }
    if (swapSlotId === slotId) { setSwapSlotId(null); return; }
    if (cfg.category === "postcard") {
      selectSlot(slotId);
      const slot = cfg.slots.find((item) => item.id === slotId);
      if (!slot) return;
      if (!slot.photoId) { void replaceSlotFromGallery(slotId); return; }
      Alert.alert("Фото открытки", "Что изменить?", [
        { text: "Заменить фото", onPress: () => { void replaceSlotFromGallery(slotId); } },
        { text: "Редактировать фото", onPress: () => openPhotoEditor(slot) },
        { text: "Отмена", style: "cancel" },
      ]);
      return;
    }
    if (selectedSlotId === slotId) { setSelectedSlotId(null); return; }
    selectSlot(slotId);
  };

  const swapSlots = (a: string, b: string) => {
    setCfg((prev) => {
      const sa = prev.slots.find((s) => s.id === a);
      const sb = prev.slots.find((s) => s.id === b);
      if (!sa || !sb) return prev;
      return { ...prev, slots: prev.slots.map((s) => (s.id === a ? { ...s, photoId: sb.photoId } : s.id === b ? { ...s, photoId: sa.photoId } : s)) };
    });
  };

  // ——— Перетаскивание фото из лотка на страницу ———
  const slotRefs = useRef(new Map<string, ViewRef>());

  const registerSlot = useCallback((id: string, ref: ViewRef | null) => {
    if (ref) slotRefs.current.set(id, ref);
    else slotRefs.current.delete(id);
  }, []);

  const openPhotoEditor = (slot: PhotoSlot) => {
    if (!slot.photoId) return;
    // Measure the actual image area: accounts for every grid, orientation, margin and frame.
    const ref = slotRefs.current.get(slot.id);
    if (!ref) { showToast("Выберите фото в макете", "warning-outline"); return; }
    ref.measure((_x, _y, w, h) => {
      if (w <= 0 || h <= 0) return;
      setEditorRatio(w / h);
      setEditingPhotoId(slot.photoId!);
    });
  };

  const dragInfo = useRef<{ active: boolean; rects: DropRect[] }>({ active: false, rects: [] });

  // Позиция «призрака» — в анимационных значениях: движение пальца не вызывает
  // ре-рендер дерева, поэтому драг остаётся плавным даже на тяжёлом экране редактора.
  const ghostPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const [dragPhoto, setDragPhoto] = useState<string | null>(null);

  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // На время драга блокируем горизонтальный скролл лотка: иначе нативный скролл
  // перехватывает жест, и призрак «зависает» через несколько пикселей движения.
  const [trayScrollLocked, setTrayScrollLocked] = useState(false);

  const [postcardInteracting, setPostcardInteracting] = useState(false);

  const lockTrayScroll = useCallback(() => setTrayScrollLocked(true), []);

  const unlockTrayScroll = useCallback(() => setTrayScrollLocked(false), []);

  const hitSlot = (rects: DropRect[], x: number, y: number) => {
    let best: string | null = null;
    let bestArea = Infinity;
    for (const r of rects) {
      const inside = x >= r.x - 10 && x <= r.x + r.w + 10 && y >= r.y - 10 && y <= r.y + r.h + 10;
      if (inside && r.w * r.h < bestArea) { bestArea = r.w * r.h; best = r.id; }
    }
    return best;
  };

  const beginDrag = (photoId: string, x: number, y: number) => {
    if (dragInfo.current.active) return;
    const rects: DropRect[] = [];
    slotRefs.current.forEach((ref, id) => {
      ref.measureInWindow((rx, ry, rw, rh) => {
        if (rw > 0 && rh > 0) rects.push({ id, x: rx, y: ry, w: rw, h: rh });
      });
    });
    dragInfo.current = { active: true, rects };
    ghostPos.setValue({ x: x - 34, y: y - 34 });
    setDragPhoto(photoId);
  };

  const moveDrag = (photoId: string, x: number, y: number) => {
    ghostPos.setValue({ x: x - 34, y: y - 34 });
    const target = hitSlot(dragInfo.current.rects, x, y);
    setDropTargetId((prev) => (prev === target ? prev : target));
  };

  const endDrag = (photoId: string, x: number, y: number) => {
    const target = dragInfo.current.active && x >= 0 ? hitSlot(dragInfo.current.rects, x, y) : null;
    dragInfo.current = { active: false, rects: [] };
    unlockTrayScroll();
    setDragPhoto(null);
    setDropTargetId(null);
    if (target) {
      assignPhoto(photoId, target);
      showToast("Фото размещено на странице", "checkmark-circle");
    }
  };

  const assignPhoto = (photoId: string, slotId: string) => {
    const idx = cfg.slots.findIndex((s) => s.id === slotId);
    setCfg((prev) => {
      const target = prev.slots.find((s) => s.id === slotId);
      if (!target) return prev;
      const holder = prev.slots.find((s) => s.photoId === photoId && s.id !== slotId);
      return {
        ...prev,
        slots: prev.slots.map((s) => {
          if (s.id === slotId) return { ...s, photoId };
          if (holder && s.id === holder.id) return { ...s, photoId: target.photoId };
          return s;
        }),
      };
    });
    const nextEmpty = cfg.slots.find((s, i) => i > idx && !s.photoId) ?? cfg.slots.find((s) => !s.photoId && s.id !== slotId);
    selectSlot(nextEmpty ? nextEmpty.id : slotId);
  };

  const onTrayPick = (photoId: string) => {
    setSwapSlotId(null);
    if (selectedSlotId) { assignPhoto(photoId, selectedSlotId); return; }
    const empty = cfg.slots.find((s) => !s.photoId);
    if (empty) { assignPhoto(photoId, empty.id); return; }
    const holder = cfg.slots.find((s) => s.photoId === photoId);
    if (holder) selectSlot(holder.id);
  };

  const clearSelectedSlot = () => {
    if (!selectedSlotId) return;
    setCfg((prev) => ({ ...prev, slots: prev.slots.map((s) => (s.id === selectedSlotId ? { ...s, photoId: undefined } : s)) }));
  };

  const replaceSlotFromGallery = async (slotId: string) => {
    if (pickingPhoto.current) return;
    pickingPhoto.current = true;
    try {
      const picked = await pickAssets(false);
      if (!picked[0]) return;
      const next = [...photosRef.current, picked[0]];
      setPhotos(next);
      setCfg((prev) => ({ ...prev, slots: prev.slots.map((slot) => (slot.id === slotId ? { ...slot, photoId: picked[0].id } : slot)) }));
      selectSlot(slotId);
    } catch {
      Alert.alert("Фото не добавлено", "Попробуйте выбрать снимок ещё раз.");
    } finally {
      pickingPhoto.current = false;
    }
  };

  // Хронологический порядок: снимки с известным временем съёмки — по возрастанию,
  // снимки без метаданных — в конце, в исходном порядке выбора.
  const chronologicalPhotos = (list: Photo[]) => {
    const dated = list
      .filter((p) => typeof p.timestamp === "number")
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    const rest = list.filter((p) => typeof p.timestamp !== "number");
    return [...dated, ...rest];
  };

  const autoArrange = () => {
    animate();
    setSwapSlotId(null);
    setSelectedSlotId(null);
    setBookPage(0);
    const ordered = chronologicalPhotos(photosRef.current);
    setPhotos(ordered);
    setCfg((prev) => ({
      ...prev,
      slots: syncSlots({ ...prev, slots: prev.slots.map((s) => ({ ...s, photoId: undefined })) }, ordered),
    }));
    const dated = ordered.filter((p) => typeof p.timestamp === "number").length;
    showToast(
      dated > 0 ? `Расставлено по времени съёмки: ${dated}` : "Расставлено по порядку выбора",
      "color-wand-outline",
    );
  };

  const autoSmartArrange = () => {
    animate(); setSwapSlotId(null); setSelectedSlotId(null); setBookPage(0);
    setCfg(prev => makeSmartLayout(prev, photosRef.current));
    showToast('Макет подобран по пропорциям и качеству фото', 'sparkles-outline');
  };

  // Снимки без геометок остаются в исходном порядке в конце списка.
  const GEO_GROUP_RADIUS = 500;
  // метров: «снято в одном месте»

  // Группы фото по близости координат: кластер растёт от первого фото группы,
  // внутри группы — по времени съёмки, группы — от самой ранней поездки/съёмки.
  const photoLocationGroups = (list: Photo[]): Photo[][] => {
    const assigned = new Set<number>();
    const clusters: { idx: number[] }[] = [];
    list.forEach((p, i) => {
      if (!p.geo || assigned.has(i)) return;
      const members: number[] = [];
      list.forEach((q, j) => {
        if (assigned.has(j) || !q.geo) return;
        if (geoDistance(p.geo as { lat: number; lng: number }, q.geo) <= GEO_GROUP_RADIUS) {
          members.push(j);
          assigned.add(j);
        }
      });
      clusters.push({ idx: members });
    });
    const clusterKey = (idx: number[]) => {
      const times = idx.map((i) => list[i].timestamp).filter((t): t is number => typeof t === "number");
      if (times.length > 0) return { t: Math.min(...times), first: idx[0] };
      return { t: Infinity, first: idx[0] };
    };
    clusters.sort((a, b) => {
      const ka = clusterKey(a.idx);
      const kb = clusterKey(b.idx);
      return ka.t !== kb.t ? ka.t - kb.t : ka.first - kb.first;
    });
    const sortMembers = (idx: number[]) =>
      [...idx].sort((x, y) => {
        const tx = list[x].timestamp, ty = list[y].timestamp;
        if (typeof tx === "number" && typeof ty === "number") return tx - ty;
        return x - y;
      });
    const grouped = clusters.map((c) => sortMembers(c.idx).map((i) => list[i]));
    const rest = list.filter((p) => !p.geo);
    return [...grouped.map((g) => g), ...(rest.length > 0 ? [rest] : [])];
  };

  const autoArrangeByLocation = () => {
    animate();
    setSwapSlotId(null);
    setSelectedSlotId(null);
    setBookPage(0);
    const groups = photoLocationGroups(photosRef.current);
    const ordered = groups.flat();
    setPhotos(ordered);
    setCfg((prev) => ({
      ...prev,
      slots: syncSlots({ ...prev, slots: prev.slots.map((s) => ({ ...s, photoId: undefined })) }, ordered),
    }));
    const located = ordered.filter((p) => p.geo).length;
    if (located === 0) showToast("У фото нет геометок — расставлено по порядку", "location-outline");
    else if (groups.length === 1 && located === ordered.length) showToast(`Все фото с одного места: ${located}`, "location-outline");
    else showToast(`Мест в книге: ${groups.length} · фото с геометкой: ${located}`, "location-outline");
  };

  // ——— Расчёты ———
  const base = useMemo(() => baseEstimate(cfg), [cfg]);

  const aiCost = useMemo(() => aiSurcharge(cfg), [cfg]);

  const price = base + aiCost;

  const aiCount = (cfg.aiTools ?? []).length;

  const delivery = DELIVERY_OPTIONS.find((d) => d.id === deliveryId);

  const deliveryPrice = delivery?.price ?? 0;

  const promoCode = promo.trim().toUpperCase();

  // С сервером промокод проверяется запросом (с задержкой на ввод), без сервера — локальный PROMO_CODE.
  const [promoCheck, setPromoCheck] = useState<{ code: string; percent: number | null; error?: string } | null>(null);

  useEffect(() => {
    if (!apiOnline || !promoCode) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await validatePromo(promoCode);
        if (alive) setPromoCheck(r.valid ? { code: promoCode, percent: r.discountPercent } : { code: promoCode, percent: null, error: r.error });
      } catch {
        if (alive) setPromoCheck(null);
      }
    }, 450);
    return () => { alive = false; clearTimeout(t); };
  }, [apiOnline, promoCode]);

  const promoPercent = apiOnline
    ? (promoCheck?.code === promoCode ? promoCheck.percent ?? 0 : 0)
    : (promoCode === PROMO_CODE ? PROMO_DISCOUNT * 100 : 0);

  const promoValid = promoPercent > 0;

  const promoError = apiOnline && promoCode && promoCheck?.code === promoCode ? promoCheck.error ?? null : null;

  // Округляем до копеек так же, как сервер, чтобы сумма в приложении и в заказе совпадала.
  const discount = promoValid ? Math.round(price * promoPercent) / 100 : 0;

  const totalPrice = price - discount + deliveryPrice;

  const filled = filledCount(cfg);

  const usedPhotoIds = new Set(cfg.slots.map((s) => s.photoId).filter(Boolean));

  const unusedPhotos = photos.length - usedPhotoIds.size;

  const emptySlots = cfg.slots.length - filled;

  // Пропорция постера (ширина/высота) — та же, что в FlatPreview, для AR-примерки.
  const [posterPW, posterPH] = (POSTER_SIZES.find((s) => s.id === cfg.posterSizeId)?.label ?? "30×40").split("×").map((x) => parseFloat(x));

  const posterAspect = cfg.posterOrientation === "portrait" ? posterPW / posterPH : posterPH / posterPW;

  const selectedSlot = cfg.slots.find((s) => s.id === selectedSlotId);

  const selectedIndex = selectedSlot ? cfg.slots.indexOf(selectedSlot) : -1;

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  // Статусы меняет менеджер в админке — подтягиваем их: чаще на экранах заказов и профиля, реже на остальных.
  const ordersScreen = screen === "orders" || screen === "profile";
  useEffect(() => {
    if (!apiOnline) return;
    let alive = true;
    // Ошибку сети игнорируем — остаётся уже загруженный список.
    const load = () => fetchOrders().then((list) => { if (alive) applyRemoteOrders(list); }, () => { });
    if (ordersScreen) void load();
    const t = setInterval(load, ordersScreen ? 15000 : 30000);
    return () => { alive = false; clearInterval(t); };
  }, [apiOnline, ordersScreen, applyRemoteOrders]);

  const activeOrder = orders.find((o) => !o.cancelled && o.statusIndex < ORDER_STATUSES.length - 1);

  const lowRes = useMemo(() => lowResCount(cfg, photos), [cfg, photos]);
  const qualityIssues = photos.filter(p => p.quality?.issues.length);
  const usedQualityIssues = qualityIssues.filter(p => cfg.slots.some(s => s.photoId === p.id));
  const [checkoutWarning, setCheckoutWarning] = useState<string | null>(null);
  useEffect(() => { setCheckoutWarning(null); }, [cfg, photos]);
  const reviewCheckout = () => {
    if ((usedQualityIssues.length || lowRes) && !checkoutWarning) {
      setCheckoutWarning(`Проверьте фото перед печатью: ${usedQualityIssues.length ? usedQualityIssues.map(p => p.quality!.issues.join(', ')).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(' · ') : 'недостаточно пикселей для выбранного формата'}. Обработка не восстанавливает утраченные детали.`);
      return;
    }
    setScreen('checkout');
  };

  const resetAfterOrder = (orderId: string) => {
    if (draftId) setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    setDraftId(null);
    setSavedSig(null);
    setPhotos([]);
    setScenarioTitle(undefined);
    setPromo("");
    setCfg(makeConfig("print", []));
    setSelectedSlotId(null);
    setSwapSlotId(null);
    setSelectedOrderId(orderId);
    setScreen("orders");
  };

  const placeOrder = async () => {
    if (placingOrder) return;
    if (!recipient.name.trim() || recipient.phone.trim().length < 7 || !recipient.address.trim()) {
      showToast("Заполните имя, телефон и адрес", "alert-circle-outline");
      return;
    }
    const aiNote = aiCount ? ` · AI: ${aiCount}` : "";
    const items = `${photos.length} фото · ${productDetails(cfg)}${aiNote}`;
    const scenario = scenarioTitle ?? "Новый заказ";
    const localPreview = photos[0]?.uri ?? COVER_URLS[0];

    if (apiOnline) {
      setPlacingOrder(true);
      try {
        const remote = await createOrder({
          config: cfg, scenario, items, photoCount: filled, recipient, deliveryId, paymentId,
          promoCode: promoValid ? promoCode : undefined, clientTotal: totalPrice, photoInfo: slotPhotoInfo(cfg, photos),
        });
        // Пока фото грузятся, показываем локальное превью.
        setOrders((prev) => [{ ...remote, previewUri: localPreview }, ...prev.filter((o) => o.id !== remote.id)]);
        const orderCfg = cfg;
        const orderPhotos = photos;
        void uploadOrderPhotos(remote.id, orderCfg, orderPhotos).then(({ ok, total, error }) => {
          if (ok < total) {
            showToast(`Загружено фото: ${ok} из ${total}${error ? ` — ${error}` : ""}`, "cloud-offline-outline");
            console.warn(`[PicPac] Фото заказа ${remote.id}: загружено ${ok} из ${total}`, error);
          }
        });
        resetAfterOrder(remote.id);
        showToast(`Заказ ${remote.id} оформлен! Следите за статусом здесь`, "sparkles");
        return;
      } catch (e) {
        // Ошибку проверки (промокод закончился, позиция скрыта) показываем как есть.
        if (e instanceof ApiError && e.status > 0) {
          showToast(e.message, "alert-circle-outline");
          return;
        }
        showToast("Сервер недоступен — заказ сохранён только на телефоне", "cloud-offline-outline");
      } finally {
        setPlacingOrder(false);
      }
    }

    const newOrder: MockOrder = {
      id: `ord-${Math.floor(Math.random() * 9000 + 1000)}`, title: productTitle(cfg), scenario,
      status: "accepted", statusIndex: 0, total: totalPrice, previewUri: localPreview, date: "Сегодня", items,
    };
    setOrders((prev) => [newOrder, ...prev]);
    resetAfterOrder(newOrder.id);
    if (!apiOnline) showToast("Заказ оформлен! Следите за статусом здесь", "sparkles");
  };

  const advanceOrder = () =>
    setOrders((prev) => prev.map((o, i) => (i === 0 && o.statusIndex < ORDER_STATUSES.length - 1 ? { ...o, statusIndex: o.statusIndex + 1 } : o)));

  const panelTitle =
    panelContent === "products" ? "Что напечатать?" : panelContent === "settings" ? "Формат и оформление" : panelContent === "ai" ? "AI-студия" : "Фотографии и автомакет";
  return { apiOnline, catalogVersion, placingOrder, promoPercent, promoError, autoSmartArrange, qualityChecking, qualityIssues, checkoutWarning, reviewCheckout, activeOrder, aiCost, aiCount, applyPhotoEdit, applyPrintToAll, arNotice, arOpen, arPhase, arPinchResponder, arPosterPos, arPosterSize, arRef, arTracking, autoArrange, autoArrangeByLocation, base, beginDrag, bookPage, cfg, checkoutPreviewOpen, chooseProductAfterUpload, chooseUploadedProduct, clearArAnchors, clearPhotos, clearSelectedSlot, deleteDraft, delivery, deliveryId, deliveryPrice, discount, dragPhoto, dropTargetId, editingPhoto, editorPanel, editorRatio, emptySlots, endDrag, filled, ghostPos, goToBuilder, handleArAnchors, handleArProjection, handleArTap, handleSlotPress, hexTarget, hexValid, hexValue, insets, isSaved, leaveBuilder, lockTrayScroll, lowRes, moveDrag, onTrayPick, openDraft, openPhotoEditor, openTextEditor, orders, panelContent, panelTitle, paymentId, photos, pickMore, placeOrder, postcardInteracting, posterAspect, price, promo, promoValid, recipient, registerSlot, removePhoto, removeSpread, replaceSlotFromGallery, saveDraft, scenarioTitle, screen, selectedOrder, selectedSlot, selectedSlotId, setArNotice, setArOpen, setArTracking, setBookPage, setCheckoutPreviewOpen, setDeliveryId, setEditingPhotoId, setEditorPanel, setHexTarget, setHexValue, setPaymentId, setPostcardInteracting, setPromo, setRecipient, setScenarioTitle, setScreen, setSelectedOrderId, setSpreadLayout, setSwapSlotId, setTextDraft, setTextEditing, showToast, slideDir, spreadIsEmpty, startFlow, swapSlotId, switchCategory, textDraft, textEditing, textField, toast, totalPrice, trayScrollLocked, unusedPhotos, updateCfg, updatePrintSlot, visibleDrafts, width };
}
export type PicPacController = ReturnType<typeof usePicPacController>;

