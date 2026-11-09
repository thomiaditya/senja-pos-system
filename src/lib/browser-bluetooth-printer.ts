// Koneksi printer thermal Bluetooth langsung dari browser kasir (Web Bluetooth).
// Hanya printer Bluetooth Low Energy (BLE) yang bisa dijangkau. Printer Bluetooth Classic (SPP)
// tidak bisa diakses dari browser, gunakan mode port serial di Pengaturan untuk itu.

const PRINTER_SERVICE_UUIDS = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

// ATT MTU default 23 byte dikurangi header 3 byte, agar tiap tulisan diterima semua jenis perangkat.
const WRITE_CHUNK_BYTES = 20;

type BluetoothCharacteristic = {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithResponse(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
};

type BluetoothGattServer = {
  connected: boolean;
  connect(): Promise<BluetoothGattServer>;
  disconnect(): void;
  getPrimaryServices(): Promise<{ getCharacteristics(): Promise<BluetoothCharacteristic[]> }[]>;
};

type BluetoothDevice = {
  id: string;
  name?: string;
  gatt?: BluetoothGattServer;
  addEventListener(type: "gattserverdisconnected", listener: () => void): void;
};

type WebBluetooth = {
  requestDevice(options: { acceptAllDevices: true; optionalServices: string[] }): Promise<BluetoothDevice>;
};

export type BrowserPrinter = {
  id: string;
  name: string;
};

type Connection = {
  device: BluetoothDevice;
  info: BrowserPrinter;
};

let connection: Connection | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function getWebBluetooth(): WebBluetooth | null {
  if (typeof navigator === "undefined" || !window.isSecureContext) return null;
  const bluetooth = (navigator as Navigator & { bluetooth?: WebBluetooth }).bluetooth;
  return bluetooth ?? null;
}

export function isBrowserBluetoothSupported() {
  return getWebBluetooth() !== null;
}

export function subscribeBrowserPrinter(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBrowserPrinter(): BrowserPrinter | null {
  return connection?.info ?? null;
}

// Mengembalikan null jika pengguna membatalkan pemilihan perangkat.
export async function connectBrowserPrinter(): Promise<BrowserPrinter | null> {
  const bluetooth = getWebBluetooth();
  if (!bluetooth) {
    throw new Error("Browser ini tidak bisa memakai Bluetooth. Gunakan Chrome atau Edge di HTTPS atau localhost.");
  }

  let device: BluetoothDevice;
  try {
    device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICE_UUIDS });
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") return null;
    throw new Error("Pemilihan printer Bluetooth dibatalkan atau gagal.");
  }

  if (!device.gatt) throw new Error("Perangkat ini tidak mendukung koneksi GATT.");
  await device.gatt.connect();
  // Pastikan perangkat punya karakteristik tulis sebelum dianggap terhubung.
  try {
    await findWritableCharacteristic(device);
  } catch (error) {
    device.gatt.disconnect();
    throw error;
  }

  const info = { id: device.id, name: device.name || "Printer Bluetooth" };
  connection = { device, info };
  device.addEventListener("gattserverdisconnected", () => {
    if (connection?.device === device) {
      connection = null;
      notify();
    }
  });
  notify();
  return info;
}

export function disconnectBrowserPrinter() {
  const current = connection;
  connection = null;
  current?.device.gatt?.disconnect();
  notify();
}

async function findWritableCharacteristic(device: BluetoothDevice) {
  const server = device.gatt;
  if (!server) throw new Error("Printer tidak terhubung.");
  if (!server.connected) await server.connect();

  const services = await server.getPrimaryServices();
  let fallback: BluetoothCharacteristic | null = null;
  for (const service of services) {
    for (const characteristic of await service.getCharacteristics()) {
      if (characteristic.properties.writeWithoutResponse) return characteristic;
      if (characteristic.properties.write && !fallback) fallback = characteristic;
    }
  }
  if (fallback) return fallback;
  throw new Error("Printer ini tidak punya layanan tulis yang didukung. Pastikan printer BLE, bukan Bluetooth Classic.");
}

// Mengirim byte ESC/POS per potongan kecil. Karakteristik dicari ulang setiap cetak
// karena objek GATT lama tidak valid setelah perangkat terputus dan terhubung lagi.
export async function printOverBrowserBluetooth(bytes: Uint8Array) {
  if (!connection) throw new Error("Printer Bluetooth belum terhubung.");
  const { device } = connection;
  let characteristic: BluetoothCharacteristic;
  try {
    characteristic = await findWritableCharacteristic(device);
  } catch {
    throw new Error(`Printer ${connection.info.name} tidak terjangkau. Hubungkan ulang printer Bluetooth.`);
  }

  const useWithoutResponse = characteristic.properties.writeWithoutResponse;
  try {
    for (let offset = 0; offset < bytes.length; offset += WRITE_CHUNK_BYTES) {
      const chunk = bytes.slice(offset, offset + WRITE_CHUNK_BYTES);
      if (useWithoutResponse) await characteristic.writeValueWithoutResponse(chunk);
      else await characteristic.writeValueWithResponse(chunk);
    }
  } catch {
    throw new Error(`Printer ${connection.info.name} menolak data. Coba hubungkan ulang.`);
  }
}
