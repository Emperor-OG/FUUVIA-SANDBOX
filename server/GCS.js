const { Storage } = require("@google-cloud/storage");

/* =========================================================
   SAFER CREDENTIAL LOADING
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
   STORAGE INIT (IMPORTANT: no deprecated "credentials" usage)
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
   UPLOAD FILE (FIXED STREAM HANDLING)
========================================================= */
async function uploadFileToBucket(file, bucket) {
  if (!file) return null;

  if (!bucket?.file) {
    throw new Error("Invalid bucket passed to uploadFileToBucket()");
  }

  return new Promise((resolve, reject) => {
    const safeName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}-${file.originalname}`;

    const blob = bucket.file(safeName);

    const stream = blob.createWriteStream({
      resumable: false,
      gzip: false, // IMPORTANT: prevents stream corruption in some setups
      metadata: {
        contentType: file.mimetype,
      },
      timeout: 120000, // prevent premature kill
    });

    let finished = false;

    const cleanup = (err) => {
      if (finished) return;
      finished = true;

      stream.removeAllListeners();

      if (err) {
        console.error("GCS Upload Error:", err);
        reject(err);
      }
    };

    stream.on("error", cleanup);

    stream.on("finish", () => {
      if (finished) return;
      finished = true;

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

      resolve(publicUrl);
    });

    try {
      // VERY IMPORTANT SAFETY CHECK
      if (!file.buffer) {
        throw new Error("File buffer is missing (multer misconfigured)");
      }

      stream.end(Buffer.from(file.buffer));
    } catch (err) {
      cleanup(err);
    }
  });
}

/* =========================================================
   DELETE FILE
========================================================= */
async function deleteFileFromBucket(bucket, fileUrl) {
  try {
    if (!fileUrl) return;

    const fileName = decodeURIComponent(
      fileUrl.split(`/${bucket.name}/`)[1]
    );

    await bucket.file(fileName).delete();

    console.log("Deleted file:", fileName);
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
