const startCameraButton = document.getElementById("start-camera");
const takePhotoButton = document.getElementById("take-photo");
const startRecordButton = document.getElementById("start-record");
const stopRecordButton = document.getElementById("stop-record");
const addItemButton = document.getElementById("add-item");
const cameraStatus = document.getElementById("camera-status");
const videoElement = document.getElementById("camera");
const photoCanvas = document.getElementById("photo-canvas");
const itemNameInput = document.getElementById("item-name");
const productNumberInput = document.getElementById("product-number");
const vendorNameInput = document.getElementById("vendor-name");
const vendorPriceInput = document.getElementById("vendor-price");
const itemLocationInput = document.getElementById("item-location");
const itemNotesInput = document.getElementById("item-notes");
const inventoryList = document.getElementById("inventory-list");
const inventoryCount = document.getElementById("inventory-count");
const cardTemplate = document.getElementById("inventory-card-template");
const exportCsvButton = document.getElementById("export-csv");

let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let pendingMedia = null;
const inventoryItems = [];
const STORAGE_KEY = "inventoryItems";

const setControlsEnabled = (enabled) => {
  takePhotoButton.disabled = !enabled;
  startRecordButton.disabled = !enabled;
  stopRecordButton.disabled = true;
  addItemButton.disabled = !pendingMedia;
};

const updateInventoryCount = () => {
  const count = inventoryItems.length;
  inventoryCount.textContent = `${count} item${count === 1 ? "" : "s"} captured`;
  exportCsvButton.disabled = count === 0;
};

const renderInventory = () => {
  inventoryList.innerHTML = "";

  inventoryItems.forEach((item, index) => {
    const card = cardTemplate.content.cloneNode(true);
    const mediaContainer = card.querySelector(".media");
    const title = card.querySelector("h3");
    const meta = card.querySelector(".meta");
    const notes = card.querySelector(".notes");
    const removeButton = card.querySelector("button");

    if (!item.url) {
      const placeholder = document.createElement("p");
      placeholder.textContent = "Media stored on device only.";
      placeholder.classList.add("media-placeholder");
      mediaContainer.appendChild(placeholder);
    } else if (item.type === "photo") {
      const image = document.createElement("img");
      image.src = item.url;
      image.alt = item.name;
      mediaContainer.appendChild(image);
    } else {
      const clip = document.createElement("video");
      clip.src = item.url;
      clip.controls = true;
      clip.playsInline = true;
      mediaContainer.appendChild(clip);
    }

    title.textContent = item.name || "Untitled item";
    const vendorLine = item.vendor
      ? `${item.vendor}${item.vendorPrice ? ` ($${item.vendorPrice})` : ""}`
      : "No vendor";
    const productLine = item.productNumber ? `#${item.productNumber}` : "No product number";
    meta.textContent = `${productLine} · ${vendorLine} · ${
      item.location || "No location"
    } · ${item.timestamp}`;
    notes.textContent = item.notes || "No notes added.";

    removeButton.addEventListener("click", () => {
      const [removed] = inventoryItems.splice(index, 1);
    if (removed && removed.url) {
      URL.revokeObjectURL(removed.url);
    }
    persistInventory();
      renderInventory();
      updateInventoryCount();
    });

  inventoryList.appendChild(card);
  });
};

const updatePendingStatus = (message) => {
  cameraStatus.textContent = message;
  addItemButton.disabled = !pendingMedia;
  exportCsvButton.disabled = inventoryItems.length === 0;
};

const startCamera = async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    updatePendingStatus("Camera access is not supported on this device.");
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: true,
    });
    videoElement.srcObject = mediaStream;
    cameraStatus.textContent = "Camera ready. Capture a photo or record a video.";
    setControlsEnabled(true);
    exportCsvButton.disabled = inventoryItems.length === 0;
  } catch (error) {
    cameraStatus.textContent = "Unable to access camera. Check permissions.";
  }
};

const capturePhoto = () => {
  if (!mediaStream) return;

  const context = photoCanvas.getContext("2d");
  context.drawImage(videoElement, 0, 0, photoCanvas.width, photoCanvas.height);
  photoCanvas.toBlob((blob) => {
    if (!blob) return;
    pendingMedia = {
      type: "photo",
      url: URL.createObjectURL(blob),
    };
    updatePendingStatus("Photo captured. Add item details to save.");
  }, "image/jpeg");
};

const startRecording = () => {
  if (!mediaStream || mediaRecorder?.state === "recording") return;

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(mediaStream, {
    mimeType: "video/webm;codecs=vp9,opus",
  });

  mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  });

  mediaRecorder.addEventListener("stop", () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    pendingMedia = {
      type: "video",
      url: URL.createObjectURL(blob),
    };
    updatePendingStatus("Video captured. Add item details to save.");
    stopRecordButton.disabled = true;
    startRecordButton.disabled = false;
  });

  mediaRecorder.start();
  startRecordButton.disabled = true;
  stopRecordButton.disabled = false;
  updatePendingStatus("Recording... tap stop when done.");
};

const stopRecording = () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
};

const addInventoryItem = () => {
  if (!pendingMedia) return;

  const timestamp = new Date().toLocaleString();
  inventoryItems.unshift({
    type: pendingMedia.type,
    url: pendingMedia.url,
    name: itemNameInput.value.trim(),
    productNumber: productNumberInput.value.trim(),
    vendor: vendorNameInput.value.trim(),
    vendorPrice: vendorPriceInput.value.trim(),
    location: itemLocationInput.value.trim(),
    notes: itemNotesInput.value.trim(),
    timestamp,
  });

  pendingMedia = null;
  itemNameInput.value = "";
  productNumberInput.value = "";
  vendorNameInput.value = "";
  vendorPriceInput.value = "";
  itemLocationInput.value = "";
  itemNotesInput.value = "";
  updatePendingStatus("Item saved. Capture another photo or video.");
  persistInventory();
  renderInventory();
  updateInventoryCount();
};

const persistInventory = () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      inventoryItems.map(({ url, ...item }) => item)
    )
  );
  exportCsvButton.disabled = inventoryItems.length === 0;
};

const restoreInventory = () => {
  const storedItems = localStorage.getItem(STORAGE_KEY);
  if (!storedItems) return;

  const parsed = JSON.parse(storedItems);
  parsed.forEach((item) => inventoryItems.push(item));
};

const buildCsvRow = (values) =>
  values
    .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
    .join(",");

const exportCsv = () => {
  if (!inventoryItems.length) return;

  const header = buildCsvRow([
    "Item name",
    "Product number",
    "Vendor",
    "Vendor price",
    "Location",
    "Notes",
    "Captured at",
    "Media type",
  ]);

  const rows = inventoryItems.map((item) =>
    buildCsvRow([
      item.name,
      item.productNumber,
      item.vendor,
      item.vendorPrice,
      item.location,
      item.notes,
      item.timestamp,
      item.type,
    ])
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

startCameraButton.addEventListener("click", startCamera);
takePhotoButton.addEventListener("click", capturePhoto);
startRecordButton.addEventListener("click", startRecording);
stopRecordButton.addEventListener("click", stopRecording);
addItemButton.addEventListener("click", addInventoryItem);
exportCsvButton.addEventListener("click", exportCsv);

restoreInventory();
renderInventory();
updateInventoryCount();
