import { Language, translateWithFormat } from "./localization";
import { Trans } from "./translation";

describe("localization", () => {
    test("localization works without parameters", () => {
        const w = translateWithFormat(Trans.UserAlreadySentAnInvitation, Language.English);
        expect(w).toEqual("You already sent an invitation to this user.");
    });

    test("localization works with parameters", () => {
        const w = translateWithFormat(Trans.UserIsNotBeingFollowed, Language.English, "a", "b");
        expect(w).toEqual("a does not follow b");
    });
});
