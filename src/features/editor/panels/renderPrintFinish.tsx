import { getPrintFinish } from '../../../domain/products';
import type { PicPacController } from '../../../state/usePicPacController';
import { renderFinishEditor } from './renderFinishEditor';

export function renderPrintFinish(controller: PicPacController, category: "print" | "poster") {
  const { cfg, updateCfg } = controller;

  const finish = getPrintFinish(cfg, category);
  const field = category === "print" ? "printFinish" : "posterFinish";
  return renderFinishEditor(finish, (patch) => updateCfg({ [field]: { ...finish, ...patch } }), category);

}
