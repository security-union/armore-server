/**
 * Copyright [2018] [Dario Alessandro Lencina Talarico]
 * Licensed under the Apache License, Version 2.0 (the "License");
 * y ou may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from "fs";
import { Storage } from "@google-cloud/storage";
import { logger } from "./logger";

export const Type = Object.freeze({
    CloudStorage: "cloud-storage",
    Development: "local-development",
});

export interface StorageOptions {
    bucketName: string | undefined;
    localStoragePath: string | undefined;
    cloudStorageCredentials: string | undefined;
    cloudStorageProject: string;
    storageType: string;
}

interface StorageInterface {
    storeImage(base64String: string, fileName: string): Promise<void>;
    readImage(image: string): Promise<Buffer>;
}

export class LocalStorage implements StorageInterface {
    localStoragePath: string;

    constructor(options: StorageOptions) {
        logger.info("instantiating LocalStorage");
        this.localStoragePath = options.localStoragePath!!;
    }

    storeImage(base64String: string, fileName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const data = Buffer.from(base64String, "base64");
                fs.writeFileSync(`${this.localStoragePath}/${fileName}`, data);
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }

    readImage(image: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            fs.readFile(`${this.localStoragePath}/${image}`, (err, data) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }
}

export class CloudStorage implements StorageInterface {
    storageClient: Storage;
    bucketName: string;
    cloudStorageProject: string;

    constructor(options: StorageOptions) {
        this.bucketName = options.bucketName!!;
        this.cloudStorageProject = options.cloudStorageProject;
        this.storageClient = new Storage({
            keyFilename: options.cloudStorageCredentials,
            projectId: "iot-garage-242501",
        });
    }

    async storeImage(base64String: string, fileName: string): Promise<void> {
        const imageData = Buffer.from(base64String, "base64");
        await this.storageClient.bucket(this.bucketName).file(fileName).save(imageData, {
            gzip: true,
        });
    }

    async readImage(image: string): Promise<Buffer> {
        const data = await this.storageClient.bucket(this.bucketName).file(image).download({});
        return data[0];
    }
}

export class StorageClient implements StorageInterface {
    private client: StorageInterface;

    constructor(options: StorageOptions) {
        logger.info(`instantiating storage with type ${options.storageType}`);
        switch (options.storageType) {
            case Type.CloudStorage:
                this.client = new CloudStorage(options);
                break;
            default:
                this.client = new LocalStorage(options);
        }
    }

    storeImage(base64String: string, fileName: string) {
        return this.client.storeImage(base64String, fileName);
    }

    readImage(image: string) {
        return this.client.readImage(image);
    }
}
