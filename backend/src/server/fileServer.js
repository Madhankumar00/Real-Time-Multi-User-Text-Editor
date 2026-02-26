import { deserializeTiList } from "../utils/deserializeTiList.js";
import { writeToFile } from "../utils/fileOperations.js";
import { getStorePath } from "../utils/getStorePath.js";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// For ES modules, define __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = 8080;
const app = express();

app.use(cors());
app.use(express.json());

app.post("/insert", (req, res) => {
  const reqBody = req.body;
  console.log("/insert called, reqBody:", reqBody);
  deserializeTiList(
    getStorePath(reqBody.replicaId),
    reqBody.replicaId,
    (tiList) => {
      // insert into the list after it is deserialized
      for (let i = 0; i < reqBody["modifiedLength"]; i++) {
        tiList.insert(reqBody["modifiedIndex"] + i, reqBody["modification"][i]);
      }
      writeToFile(
        tiList.toString(), // serialized TiList
        getStorePath(reqBody.replicaId)
      );
      res.send({curContent: tiList.getContentsForEditor()});
    }
  );
});

app.post("/delete", (req, res) => {
  const reqBody = req.body;
  console.log("/delete called, reqBody:", reqBody);
  deserializeTiList(
    getStorePath(reqBody.replicaId),
    reqBody.replicaId,
    (tiList) => {
      // delete from the list after it is deserialized
      for (let i = 0; i < reqBody["modifiedLength"]; i++) {
        tiList.delete(reqBody["modifiedIndex"]);
      }
      writeToFile(
        tiList.toString(), // serialized TiList
        getStorePath(reqBody.replicaId)
      );
      res.send({curContent: tiList.getContentsForEditor()});
    }
  );
});

app.post("/richtext", (req, res) => {
  const reqBody = req.body;
  console.log(`/richtext called, reqBody:`, reqBody);
  deserializeTiList(
    getStorePath(reqBody.replicaId),
    reqBody.replicaId,
    (tiList) => {
      // insert into the list after it is deserialized

      // start of `attribute`
      tiList.insert(
        reqBody["modifiedIndex"],
        reqBody["modification"],
        reqBody["attributes"]
      );

      // end of `attribute`
      tiList.insert(
        reqBody["modifiedIndex"] + reqBody["modifiedLength"],
        reqBody["modification"],
        reqBody["attributes"]
      );
      writeToFile(
        tiList.toString(), // serialized TiList
        getStorePath(reqBody.replicaId)
      );
      res.send({curContent: tiList.getContentsForEditor()});
    }
  );
});

app.post("/getContent", (req, res) => {
  const { replicaId } = req.body;
  console.log("/getContent called for replicaId:", replicaId);
  
  // Use the existing getStorePath function to get the file path
  const filePath = getStorePath(replicaId);
  
  try {
    // Check if file exists
    if (fs.existsSync(filePath)) {
      console.log(`File exists at ${filePath}, loading content...`);
      
      // Use the existing deserializeTiList function
      deserializeTiList(filePath, replicaId, (tiList) => {
        // Return current content using the existing method
        res.status(200).json({
          curContent: tiList.getContentsForEditor(),
        });
      });
    } else {
      // No file exists yet, return empty
      console.log(`No file found at ${filePath}, returning empty content`);
      res.status(200).json({
        curContent: [],
      });
    }
  } catch (error) {
    console.error("Error reading content:", error);
    res.status(500).json({ error: "Failed to read content" });
  }
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});