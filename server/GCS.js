const { Storage } = require("@google-cloud/storage");

/* =========================================================
   CREDENTIALS
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
   UPLOAD (FIXED + ROBUST)
========================================================= */
async function uploadFileToBucket(file, bucket) {
  if (!file) return null;

  if (!file.buffer) {
    throw new Error("File buffer missing (multer config issue)");
  }

  const safeName = `${Date.now()}-${Math.random()
    .toString(36)
    .substring(2)}-${file.originalname.replace(/\s/g, "_")}`;

  const blob = bucket.file(safeName);

  return new Promise((resolve, reject) => {
    const stream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: file.mimetype,
      },
    });

    stream.on("error", (err) => {
      console.error("GCS upload error:", err);
      reject(err);
    });

    stream.on("finish", () => {
      resolve(
        `https://storage.googleapis.com/${bucket.name}/${blob.name}`
      );
    });

    stream.end(file.buffer);
  });
}

/* =========================================================
   DELETE
========================================================= */
async function deleteFileFromBucket(bucket, fileUrl) {
  try {
    if (!fileUrl) return;

    const parts = fileUrl.split(`/storage.googleapis.com/${bucket.name}/`);
    const fileName = parts[1];

    if (!fileName) return;

    await bucket.file(fileName).delete();
  } catch (err) {
    if (err.code !== 404) {
      console.error("Delete failed:", err);
    }
  }
}

module.exports = {
  storage,
  buckets,
  uploadFileToBucket,
  deleteFileFromBucket,
};
