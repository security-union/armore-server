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

export const ensureThatConditionHoldsForPeriod = ({
    timeoutMs,
    callback,
    pollPeriodMs,
}: {
    timeoutMs: number;
    pollPeriodMs: number;
    callback: () => boolean;
}) => {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
        const scheduleTimer = () => {
            if (!callback()) {
                reject();
            } else {
                if (Date.now() < new Date(deadline).getTime()) {
                    setTimeout(scheduleTimer, pollPeriodMs);
                } else {
                    resolve();
                }
            }
        };
        scheduleTimer();
    });
};

export const waitForCondition = ({
    timeoutMs,
    callback,
    pollPeriodMs,
    errorToThrow,
}: {
    timeoutMs: number;
    pollPeriodMs: number;
    callback: () => boolean;
    errorToThrow: () => Error;
}) =>
    new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;
        const scheduleTimer = () => {
            if (callback()) {
                resolve();
            } else {
                if (Date.now() < new Date(deadline).getTime()) {
                    setTimeout(scheduleTimer, pollPeriodMs);
                } else {
                    reject(errorToThrow());
                }
            }
        };
        scheduleTimer();
    });
