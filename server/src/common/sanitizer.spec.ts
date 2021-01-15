/**
 * Copyright [2020] [Griffin Obeid]
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

import { getPhoneE164, ValidationError2 } from "./sanitizer";

describe("sanitizer", () => {
    describe("sanitize phone number to e164", () => {
        test("Blank string", () => {
            expect((): string => {
                return getPhoneE164("", undefined);
            }).toThrow(ValidationError2);
        });
        test("1 digit", () => {
            expect((): string => {
                return getPhoneE164("1", undefined);
            }).toThrow(ValidationError2);
        });
        test("2 digits", () => {
            expect((): string => {
                return getPhoneE164("12", undefined);
            }).toThrow(ValidationError2);
        });
        test("3 digits", () => {
            expect((): string => {
                return getPhoneE164("123", undefined);
            }).toThrow(ValidationError2);
        });
        test("4 digits", () => {
            expect((): string => {
                return getPhoneE164("1234", undefined);
            }).toThrow(ValidationError2);
        });
        test("5 digits", () => {
            expect((): string => {
                return getPhoneE164("12345", undefined);
            }).toThrow(ValidationError2);
        });
        test("6 digits", () => {
            expect((): string => {
                return getPhoneE164("123456", undefined);
            }).toThrow(ValidationError2);
        });
        test("1 +digit", () => {
            expect((): string => {
                return getPhoneE164("+1", undefined);
            }).toThrow(ValidationError2);
        });
        test("2 +digits", () => {
            expect((): string => {
                return getPhoneE164("+12", undefined);
            }).toThrow(ValidationError2);
        });
        test("3 +digits", () => {
            expect((): string => {
                return getPhoneE164("+123", undefined);
            }).toThrow(ValidationError2);
        });
        test("4 +digits", () => {
            expect((): string => {
                return getPhoneE164("+1234", undefined);
            }).toThrow(ValidationError2);
        });
        test("5 +digits", () => {
            expect((): string => {
                return getPhoneE164("+12345", undefined);
            }).toThrow(ValidationError2);
        });
        test("6 +digits", () => {
            expect((): string => {
                return getPhoneE164("+123456", undefined);
            }).toThrow(ValidationError2);
        });
        test("US phone number with e164 format already", () => {
            expect(getPhoneE164("+14155552671", undefined)).toEqual("+14155552671");
        });
        test("US phone number with e164 format already without +", () => {
            expect(getPhoneE164("14155552671", undefined)).toEqual("+14155552671");
        });
        test("US phone number with parentheses", () => {
            expect(getPhoneE164("(415) 555-2671", undefined)).toEqual("+14155552671");
        });
        test("US phone number with dashes", () => {
            expect(getPhoneE164("415-555-2671", undefined)).toEqual("+14155552671");
        });
        test("US phone number with spaces", () => {
            expect(getPhoneE164("415 555 2671", undefined)).toEqual("+14155552671");
        });
        test("Mexican phone number with e164 format already", () => {
            expect(getPhoneE164("+523221234567", undefined)).toEqual("+523221234567");
        });
        test("Mexican phone number with parentheses", () => {
            expect(getPhoneE164("+52 (322) 1234-567", undefined)).toEqual("+523221234567");
        });
        test("Mexican phone number with dashes", () => {
            expect(getPhoneE164("+52-322-123-4567", undefined)).toEqual("+523221234567");
        });
        test("Mexican phone number with spaces", () => {
            expect(getPhoneE164("+52 322 123 4567", undefined)).toEqual("+523221234567");
        });
        test("Costa Rican phone number with e164 format already", () => {
            expect(getPhoneE164("+50689999999", undefined)).toEqual("+50689999999");
        });
    });
});
