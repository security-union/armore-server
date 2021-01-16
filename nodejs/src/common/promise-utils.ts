/**
 * Copyright [2018] [Dario Alessandro Lencina Talarico]
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Wrapper for Javascript premise that allows for a timeout config parameter.
 * @param promise The original promise.
 * @param timeoutMs Timeout to wait for in ms.
 */
export const promiseWithTimeout = (promise: Promise<any>, timeoutMs: number): Promise<any> => {
    return new Promise(async (resolve, reject) => {
        setTimeout(() => {
            reject(`Premise timeout after ${timeoutMs} ms`);
        }, timeoutMs);
        const result = await promise;
        resolve(result);
    });
};
