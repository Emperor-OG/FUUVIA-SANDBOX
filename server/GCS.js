const { Storage } = require("@google-cloud/storage");

/* =========================================================
   SAFETY: ENV VALIDATION
========================================================= */
if (!process.env.GCP_PROJECT_ID) {
  throw new Error("Missing GCP_PROJECT_ID");
}

if (!process.env.GCP_PRIVATE_KEY) {
  throw new Error("Missing GCP_PRIVATE_KEY");
}

/* =========================================================
   CREDENTIALS
========================================================= */
const credentials = {
  type: "service_account",
  project_id: process.env.GCP_PROJECT_ID,
  private_key_id: process.env.GCP_PRIVATE_KEY_ID,
  private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.GCP_CLIENT_EMAIL,
  client_id: process.env.GCP_CLIENT_ID,
  auth_uri: process.env.GCP_AUTH_URI,
  token_uri: process.env.GCP_TOKEN_URI,
  auth_provider_x509_cert_url:
    process.env.GCP_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.GCP_CLIENT_CERT_URL,
};

/* =========================================================
   STORAGE INIT
========================================================= */
const storage = new Storage({
  credentials,
  projectId: process.env.GCP_PROJECT_ID,
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
  proofOfResidence: storage.bucket(
    process.env.PROOF_OF_RESIDENCE
  ),
};

/* =========================================================
   UPLOAD (ROBUST VERSION)
========================================================= */
async function uploadFileToBucket(file, bucket) {
  if (!file) return null;

  if (!bucket || typeof bucket.file !== "function") {
    throw new Error("Invalid bucket provided");
  }

  // SAFETY: ensure buffer exists
  if (!file.buffer) {
    throw new Error(
      "File buffer missing - check multer memoryStorage()"
    );
  }

  const safeName = `${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 10)}-${file.originalname}`;

  const blob = bucket.file(safeName);

  return new Promise((resolve, reject) => {
    const stream = blob.createWriteStream({
      resumable: false,
      contentType: file.mimetype,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    stream.on("error", (err) => {
      console.error("GCS upload error:", err);
      reject(err);
    });

    stream.on("finish", async () => {
      try {
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        resolve(publicUrl);
      } catch (err) {
        reject(err);
      }
    });

    // IMPORTANT SAFE WRITE
    try {
      stream.end(file.buffer);
    } catch (err) {
      console.error("Stream write failed:", err);
      reject(err);
    }
  });
}

/* =========================================================
   DELETE FILE
========================================================= */
async function deleteFileFromBucket(bucket, fileUrl) {
  try {
    if (!fileUrl) return;

    const parts = fileUrl.split("/");
    const fileName = decodeURIComponent(parts.slice(4).join("/"));

    await bucket.file(fileName).delete();

    console.log(`Deleted file: ${fileName}`);
  } catch (err) {
    if (err.code === 404) {
      console.log("File not found, skipping delete...");
    } else {
      console.error("Delete failed:", err);
    }
  }
}

module.exports = {
  buckets,
  uploadFileToBucket,
  deleteFileFromBucket,
};
