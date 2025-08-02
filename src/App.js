import React, { useState, useEffect } from "react";
import AWS from "aws-sdk";
import { gapi } from "gapi-script";
import credentials from "./credentials.json"; // adjust path
import './styles.css'
AWS.config.update({
  accessKeyId: "3MF2DSVWVGOI3S47VKY2",
  secretAccessKey: "65GzKkrWaBMgPFrMBtQrPEeGYAHIFMMTCj29QiqB",
  region: "ca-central-1",
});

const s3 = new AWS.S3({
  endpoint: "https://s3.ca-central-1.wasabisys.com",
  s3ForcePathStyle: true,
});

const CLIENT_ID =
  "992160036280-eqdq9aivb6ge2k7m4hbj45drnpsuj8mf.apps.googleusercontent.com";
const API_KEY = "AIzaSyCsYLLOsbEVnflZYmTueEXcJBaeorWdJ6w";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
const SHEET_ID = "1_4kXYSy8gwky5Xx4DCt6BxLM8QKBOfIjNfUgg5UpeoM";

const columns = [
  "Timestamp",
  "FileType",
  "FileStatus",
  "BookDetails",
  "BIN",
  "Book Cover PDF",
  "Book Cover PSD",
  "Cover Front Thumbnail",
  "Cover Back Thumbnail",
  "Book Cover Inside PDF (if applicable)",
  "Book Cover Inside PSD (if applicable)",
  "Cover Mockups",
  "Mockup 1",
  "Mockup 2",
  "Mockup 3",
  "Cover for GDP - PDF",
  "Cover for GDP - PSD",
  "Upload PDF File",
  "Upload Open File (Indesign/Word/PageMaker/.pages)",
  "Interior File for GDP",
  "Upload EPUB file",
  "Upload KPF file",
  "Upload the poster PDF",
  "Revised Mockup",
];

const UploadForm = () => {
  const [fileType, setFileType] = useState("");
  const [formData, setFormData] = useState({});
  // files: array of { fieldName, file }
  const [files, setFiles] = useState([]);

  useEffect(() => {
    function start() {
      gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        scope: SCOPES,
        discoveryDocs: [
          "https://sheets.googleapis.com/$discovery/rest?version=v4",
        ],
      });
    }
    gapi.load("client:auth2", start);
  }, []);

  const handleChange = (e) => {
    const { name, value, type, files: selectedFiles } = e.target;

    if (type === "file") {
      const newFiles = Array.from(selectedFiles).map((file) => ({
        fieldName: name,
        file,
      }));
      console.log("New files selected:", newFiles);
      setFiles((prev) => {
        // Remove any existing files for these fieldNames if you want only one file per field:
        const filtered = prev.filter(
          (f) => !newFiles.some((nf) => nf.file.name === f.file.name)
        );
        const result = [...filtered, ...newFiles];
        console.log("Updated files list:", result);
        return result;
      });
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const uploadToWasabi = async (file, bin) => {
    try {
      const key = `${bin}/${file.name}`; 
      const params = {
        Bucket: "may2025",
        Key: key,
        Body: file,
        ACL: "public-read",
        ContentType: file.type,
      };
      const res = await s3.upload(params).promise();
      const signedUrlParams = {
        Bucket: "may2025",
        Key: key,
        Expires: 60 * 60 * 24 * 365, 
      };
  
      const presignedUrl = s3.getSignedUrl("getObject", signedUrlParams);
      
      return presignedUrl;
    } catch (e) {
      console.error("Upload failed for file", file.name, e);
      return "";
    }
  };

  const fileFieldToColumn = {
    "Book Cover PDF": "Book Cover PDF",
    "Book Cover PSD": "Book Cover PSD",
    "Cover Front Thumbnail": "Cover Front Thumbnail",
    "Cover Back Thumbnail": "Cover Back Thumbnail",
    "Book Cover Inside PDF (if applicable)":
      "Book Cover Inside PDF (if applicable)",
    "Book Cover Inside PSD (if applicable)":
      "Book Cover Inside PSD (if applicable)",
    "Cover Mockups": "Cover Mockups",
    "Mockup 1": "Mockup 1",
    "Mockup 2": "Mockup 2",
    "Mockup 3": "Mockup 3",
    "Cover for GDP - PDF": "Cover for GDP - PDF",
    "Cover for GDP - PSD": "Cover for GDP - PSD",
    "Upload PDF File": "Upload PDF File",
    "Upload Open File (Indesign/Word/PageMaker/.pages)":
      "Upload Open File (Indesign/Word/PageMaker/.pages)",
    "Interior File for GDP": "Interior File for GDP",
    "Upload EPUB file": "Upload EPUB file",
    "Upload KPF file": "Upload KPF file",
    "Upload the poster PDF": "Upload the poster PDF",
    "Revised Mockup": "Revised Mockup",
  };

  const handleSignIn = async () => {
    try {
      const auth = gapi.auth2.getAuthInstance();
      await auth.signIn();
      alert("Signed in successfully!");
    } catch (error) {
      console.error("Google sign-in failed", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!fileType) {
      alert("Please select a file type");
      return;
    }

    const uploadedUrls = {};
    for (const { file, fieldName } of files) {
      const bin = formData.bin || "default-bin";
      console.log("Uploading:", file.name, "for field:", fieldName);
      const url = await uploadToWasabi(file, bin);
      console.log("Received URL:", url);

      if (url && fileFieldToColumn[fieldName]) {
        const columnName = fileFieldToColumn[fieldName];
        uploadedUrls[columnName] = url;
        // console.log(⁠ Mapped to column: ${columnName} ⁠);

        // Poster file special mapping if still needed
        if (fileType === "posterFile") {
          if (columnName === "Cover for GDP - PDF") {
            uploadedUrls["Upload PDF File"] = url;
          } else if (columnName === "Cover for GDP - PSD") {
            uploadedUrls["Upload Open File (Indesign/Word/PageMaker/.pages)"] =
              url;
          }
        }
      } else {
        uploadedUrls[fieldName] = url; // fallback
        console.log("Used fallback field:", fieldName);
      }
    }

    const row = columns.map((col) => {
      if (col === "Timestamp") return new Date().toISOString();
      if (col === "FileType") return fileType;
      if (col === "FileStatus") return formData.fileStatus || "";
      if (col === "BookDetails") return formData.bookDetails || "";
      if (col === "BIN") return formData.bin || "";
      return uploadedUrls[col] || "";
    });

    console.log("Final row to append to Google Sheets:", row);

    try {
      if (!gapi.client.sheets) {
        await gapi.client.load("sheets", "v4");
      }

      await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: "Sheet1!A1:Z1",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        resource: { values: [row] },
      });

      alert("Form data and files uploaded successfully!");
      setFormData({});
      setFiles([]);
      setFileType("");
      e.target.reset();
    } catch (error) {
      console.error("Error appending to sheet", error);
      alert("Failed to upload data to Google Sheets.");
    }
  };

  const sections = {
    coverFile: [
      "Book Cover PDF",
      "Book Cover PSD",
      "Cover Front Thumbnail",
      "Cover Back Thumbnail",
      "Book Cover Inside PDF (if applicable)",
      "Book Cover Inside PSD (if applicable)",
      "Cover Mockups",
      "Mockup 1",
      "Mockup 2",
      "Mockup 3",
      "Cover for GDP - PDF",
      "Cover for GDP - PSD",
    ],
    interiorFile: [
      "Upload PDF File",
      "Upload Open File (Indesign/Word/PageMaker/.pages)",
      "Interior File for GDP",
    ],
    epubFile: ["Upload EPUB file", "Upload KPF file"],
    posterFile: ["Upload the poster PDF"],
    globalFile: [
      "Cover for GDP - PDF",
      "Cover for GDP - PSD",
      "Revised Mockup",
      "Interior File for GDP",
    ],
  };

  return (
    <div className="center-box">
      <button onClick={handleSignIn}>Sign in with Google</button>
    

    
      <h2>Final Files</h2>
      <form onSubmit={handleSubmit}>
        <label className="text-gray-700">
          Select File Type:
          <select
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            required
          >
            <option value="">-- Select --</option>
            <option value="coverFile">Cover File</option>
            <option value="interiorFile">Interior File</option>
            <option value="epubFile">EPUB File</option>
            <option value="posterFile">Poster File</option>
            <option value="globalFile">Only Global - Cover and Interior</option>
          </select>
        </label>

        <br/>
        <label className="text-gray-700">
          BIN:
          <input
            type="text"
            name="bin"
            value={formData.bin || ""}
            onChange={handleChange}
            required
            placeholder="Enter BIN"
          />
        </label>

        <br />
        <label className="text-gray-700">
       
          <span className="text-gray-700">File Status:</span>
                <select name="fileStatus" onChange={handleChange} className="value">
                  <option value="new">New</option>
                  <option value="updated">Updated Version</option>
                </select>
        </label>

        <br />
        <label className="text-gray-700">
          Book Details:
          <input
            type="text"
            name="bookDetails"
            value={formData.bookDetails || ""}
            onChange={handleChange}
            placeholder="Enter book details"
          />
        </label>

        <br />
        {fileType &&
          sections[fileType].map((fieldName) => (
            <div key={fieldName}>
              <label className="text-gray-700">
                {fieldName}:
                <input type="file" name={fieldName} onChange={handleChange} />
              </label>
            </div>
          ))}

        <br />
        <button type="submit">Upload</button>
      </form>

      <div>
        <h3 className="text-gray-700">Selected Files:</h3>
        <ul>
          {files.map(({ file, fieldName }) => (
            <li key={file.name}>
              <strong>{fieldName}:</strong> {file.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default UploadForm