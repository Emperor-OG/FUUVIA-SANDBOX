const { Storage } = require("@google-cloud/storage");
const path = require("path");
const crypto = require("crypto");

/* =========================================================
   CREDENTIALS (SAFE)
========================================================= */
const credentials = {
  type: "service_account",
  project_id: process.env.GCP_PROJECT_ID,
  private_key_id: process.env.GCP_PRIVATE_KEY_ID,
  private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  client_email: process.env.GCP_CLIENT_EMAIL,
  client_id: process.env.GCP_CLIENT_ID,
  auth_uri: process.env.GCP_AUTH_URI,
  token_uri: process.env.GCP_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GCP_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.GCP_CLIENT_CERT_URL,
};

/* =========================================================
   STORAGE INIT
========================================================= */
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  credentials,
});

/* =========================================================
   BUCKETS
========================================================= */
const buckets = {
  storeProducts: storage.bucket(process.env.STORE_PRODUCTS),
  storeLogos: storage.bucket(process.env.STORE_LOGOS),
  storeBanners: storage.bucket(process.env.STORE_BANNERS),
  storeDocuments: storage.bucket(process.env.STORE_DOCUMENTS),
  storePOA: storage.bucket(process.env.STORE_POA),
  proofOfResidence: storage.bucket(process.env.PROOF_OF_RESIDENCE),
};

/* =========================================================
   SAFE FILE UPLOAD (FIXED STREAM HANDLING)
========================================================= */
async function uploadFileToBucket(file, bucket) {
  if (!file) return null;
  if (!bucket?.file) throw new Error("Invalid bucket provided");
  if (!file.buffer) throw new Error("File buffer missing (multer issue)");

  return new Promise((resolve, reject) => {
    // UNIQUE SAFE FILE NAME
    const safeName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${path.extname(file.originalname || "")}`;

    const blob = bucket.file(safeName);

    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: file.mimetype,
        cacheControl: "public, max-age=31536000",
      },
      timeout: 120000,
    });

    let finished = false;

    const cleanup = (err) => {
      if (finished) return;
      finished = true;

      blobStream.removeAllListeners();

      if (err) {
        return reject(err);
      }
    };

    blobStream.on("error", (err) => {
      console.error("GCS upload error:", err);
      cleanup(err);
    });

    blobStream.on("finish", () => {
      if (finished) return;
      finished = true;

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      resolve(publicUrl);
    });

    try {
      // IMPORTANT: ensure buffer is isolated per upload
      const buffer = Buffer.from(file.buffer);

      blobStream.end(buffer);
    } catch (err) {
      cleanup(err);
    }
  });
}

/* =========================================================
   DELETE FILE (SAFE PARSING)
========================================================= */
async function deleteFileFromBucket(bucket, fileUrl) {
  try {
    if (!fileUrl) return;

    const base = `https://storage.googleapis.com/${bucket.name}/`;
    const fileName = fileUrl.startsWith(base)
      ? fileUrl.replace(base, "")
      : null;

    if (!fileName) return;

    await bucket.file(fileName).delete();
  } catch (err) {
    if (err.code !== 404) {
      console.error("Delete failed:", err);
    }
  }
}

/* =========================================================
   EXPORTS
========================================================= */
module.exports = {
  storage,
  buckets,
  uploadFileToBucket,
  deleteFileFromBucket,
};
