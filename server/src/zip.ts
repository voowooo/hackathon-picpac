import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { crc32 } from "node:zlib";

// Минимальный ZIP без сжатия (метод STORE): фото уже сжаты, а без зависимостей проще.
// Файлы читаются по одному, так что в памяти держим только текущий файл.
// Ограничения формата без ZIP64: до 65535 файлов и до 4 ГБ — для заказа с запасом.

export type ZipEntry = { name: string; data?: Buffer | string; path?: string };

const DOS_EPOCH = (d: Date) => {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
};

export function zipStream(entries: ZipEntry[], now = new Date()): Readable {
  const { time, date } = DOS_EPOCH(now);
  async function* generate() {
    const central: Buffer[] = [];
    let offset = 0;
    for (const entry of entries) {
      const data = entry.path ? await readFile(entry.path) : Buffer.from(entry.data ?? "");
      const name = Buffer.from(entry.name, "utf8");
      const crc = crc32(data) >>> 0;

      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4); // версия для распаковки
      local.writeUInt16LE(0x0800, 6); // флаг: имена в UTF-8
      local.writeUInt16LE(0, 8); // STORE
      local.writeUInt16LE(time, 10);
      local.writeUInt16LE(date, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(data.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(name.length, 26);
      local.writeUInt16LE(0, 28);

      const dir = Buffer.alloc(46);
      dir.writeUInt32LE(0x02014b50, 0);
      dir.writeUInt16LE(20, 4);
      dir.writeUInt16LE(20, 6);
      dir.writeUInt16LE(0x0800, 8);
      dir.writeUInt16LE(0, 10);
      dir.writeUInt16LE(time, 12);
      dir.writeUInt16LE(date, 14);
      dir.writeUInt32LE(crc, 16);
      dir.writeUInt32LE(data.length, 20);
      dir.writeUInt32LE(data.length, 24);
      dir.writeUInt16LE(name.length, 28);
      dir.writeUInt32LE(offset, 42);
      central.push(dir, name);

      yield Buffer.concat([local, name]);
      yield data;
      offset += local.length + name.length + data.length;
    }
    const dirBuf = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(dirBuf.length, 12);
    end.writeUInt32LE(offset, 16);
    yield dirBuf;
    yield end;
  }
  return Readable.from(generate());
}
