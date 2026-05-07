const { Storage } = require("@google-cloud/storage");

/* =========================================================
   SAFE AUTH (FIXED — DO NOT USE FULL credentials OBJECT)
========================================================= */
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: {
    client_email: process.env.GCP_CLIENT_EMAIL,
    private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
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
   UPLOAD FILE (STREAM-SAFE VERSION)
========================================================= */
async function uploadFileToBucket(file, bucket) {
  if (!file?.buffer || !bucket) return null;

  const fileName = `${Date.now()}-${Math.random()
    .toString(36)
    .substring(2)}-${file.originalname}`;

  const blob = bucket.file(fileName);

  return new Promise((resolve, reject) => {
    const stream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: file.mimetype,
      },
    });

    let done = false;

    const fail = (err) => {
      if (done) return;
      done = true;

      console.error("GCS Upload Error:", err);
      reject(err);
    };

    stream.on("error", fail);

    stream.on("finish", () => {
      if (done) return;
      done = true;

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      resolve(publicUrl);
    });

    try {
      // IMPORTANT: ensure buffer is stable
      const buffer = Buffer.from(file.buffer);
      stream.end(buffer);
    } catch (err) {
      fail(err);
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

    console.log("Deleted:", fileName);
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
