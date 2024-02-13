const { Storage } = require("@google-cloud/storage");
const multer = require("multer");
const multerGoogleStorage = require("multer-google-storage");


//Very UseFul to prevent download files
const fileExtensions = [
  { extension: ".pdf", contentType: "application/pdf" },
  { extension: ".doc", contentType: "application/msword" },
  { extension: ".docx", contentType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",},
  { extension: ".txt", contentType: "text/plain" },
  { extension: ".jpg", contentType: "image/jpeg" },
  { extension: ".png", contentType: "image/png" },
  { extension: ".gif", contentType: "image/gif" },
];
const path = require("path");


// Replace with your Google Cloud Storage credentials
const storage = new Storage({
  projectId: process.env.PROJECTID,
  keyFilename: process.env.KEYFILENAME,
});

const bucketName = process.env.BUCKET;
const bucket = storage.bucket(bucketName);


//Check File Content Type
function findContentType(extension) {
  const file = fileExtensions.find((file) => file.extension === extension);
  return file ? file.contentType : null;
}


// Configure Multer with Google Cloud Storage engine
const multerStorageEngine = multerGoogleStorage.storageEngine({
  projectId: process.env.PROJECTID,
  keyFilename: process.env.KEYFILENAME,
  bucket: bucketName,
  acl: {},
  contentType: (req, file, cb) => {
    // return "application/pdf";
    const contentType = findContentType(path.extname(file.originalname));
    return contentType;
  },
  filename: (req, file, cb) => {
    let fieldName = file.fieldname; // Access the field name
    if (fieldName === "ttCopy") {
      fieldName += req.body.index;
    }
    // else if(fieldName === "idPhoto"){
    //   fieldName += req.body.idPhoto;
    // }else if(fieldName === "businessProof"){
    //   fieldName += req.body.businessProof;
    // }
    const fileExtension = path.extname(file.originalname);
    cb(null, `uploads/documents/${req.body.email}/${fieldName}${fileExtension}`); // Preserve original filename
  },
});

//Upload Files in GCP
const upload = multer({
  storage: multerStorageEngine,
});


//Check If File Exists OR Not in GCP(Google Cloud Storage)
async function checkIfFileExists(key) {
  try {
    const file = storage.bucket(bucketName).file(key);
    const [exists] = await file.exists();
    if (exists) {
      console.log(`Object exists: ${key}`);
      return true;
    } else {
      console.log(`Object does not exist: ${key}`);
      return false;
    }
  } catch (error) {
    console.error("Error checking object existence:", error.message);
    throw error;
  }
}


// Function to upload file bytes to Google Cloud Storage
async function uploadFileBytesToGCS(fileBytes, fileName) {
  return new Promise((resolve, reject) => {
    const fileStream = bucket.file(fileName).createWriteStream({
      metadata: {
        contentType: "application/pdf", // Set the content type
      },
    });

    fileStream.on("error", (err) => {
      reject(err);
    });

    fileStream.on("finish", () => {
      resolve(`https://storage.googleapis.com/${bucketName}/${fileName}`);
    });

    // Write the file bytes to the stream
    fileStream.end(fileBytes);
  });
}

//Getting Perticular File Using Signed Url
async function getFileURL(key) {
  const options = { version: "v4", action: "read", expires: Date.now() + 3600000,};

  if (!(await checkIfFileExists(key))) {
    console.log("File not found or expired!");
    return {
      success: false,
      msg: "File not found or expired !",
    };
  }

  const [url] = await storage.bucket(bucketName).file(key).getSignedUrl(options);
  return { success: true, url: url, };
}

//Delete Perticular File in GCP
async function deleteFile(key) {
  try {
    if (!(await checkIfFileExists(key))) {
      console.log("File does not exist: " + key);
      return false;
    }
    const file = storage.bucket(bucketName).file(key);
    await file.delete();
    console.log(`File deleted successfully: ${key}`);
    return true;
  } catch (error) {
    console.error("Error deleting file:", error.message);
    throw error;
  }
}


//Delete Perticular Folder in GCP
async function deleteFolder(folderName) {
  try {
    const bucket = storage.bucket(bucketName);
    const [files] = await bucket.getFiles({ prefix: folderName,});

    const promises = files.map(async (file) => {
      await file.delete();
      console.log(`File deleted successfully: ${file.name}`);
    });

    await Promise.all(promises);
    console.log(`Folder deleted successfully: ${folderName}`);
    return true;
  } catch (error) {
    console.error("Error deleting folder:", error.message);
    throw error;
  }
}

// Function to read file bytes to Google Cloud Storage
async function readPDFBytes(fileName) {
  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    // Download the file contents into a buffer
    const [fileContents] = await file.download();

    // Convert the buffer to a Uint8Array (if needed)
    const pdfBytes = Uint8Array.from(fileContents);
    console.log(`PDF bytes read successfully: ${pdfBytes.length} bytes`);
    return pdfBytes;
  } catch (error) {
    console.error("Error reading PDF bytes:", error.message);
    throw error;
  }
}



module.exports = {
  uploadFileBytesToGCS,
  getFileURL,
  deleteFile,
  readPDFBytes,
  deleteFolder,
  upload,
};
