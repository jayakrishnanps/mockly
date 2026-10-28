import assert from "node:assert/strict";
import { test } from "node:test";
import { getRememberedUser, navigateAsUser } from "../src/lib/users.ts";

function browser(t, blockedStorage = false) {
  const values = new Map();
  const navigation = [];
  const document = { cookie: "" };
  const location = {
    protocol: "https:",
    replace(path) { navigation.push({ kind: "replace", path, cookie: document.cookie, user: values.get("mockly:user") }); },
  };
  const localStorage = {
    getItem(key) { if (blockedStorage) throw new Error("Blocked"); return values.get(key) ?? null; },
    setItem(key, value) { if (blockedStorage) throw new Error("Blocked"); values.set(key, value); },
    removeItem(key) { if (blockedStorage) throw new Error("Blocked"); values.delete(key); },
  };
  for (const [name, value] of Object.entries({ document, location, window: { location, localStorage } })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    });
  }
  return { values, navigation, document };
}

test("identity selection writes the new preference before a fresh document request", (t) => {
  const { values, navigation } = browser(t);
  values.set("mockly:user", "HE");
  navigateAsUser("JK");
  assert.equal(getRememberedUser(), "JK");
  assert.deepEqual(navigation, [{
    kind: "replace", path: "/u/JK", user: "JK",
    cookie: "mockly_user=JK; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
  }]);
  navigateAsUser("HE");
  assert.equal(navigation.at(-1).path, "/u/HE");
  assert.equal(navigation.at(-1).user, "HE");
  assert.match(navigation.at(-1).cookie, /^mockly_user=HE;/);
});

test("switching to the picker clears both preferences before replacing the document", (t) => {
  const { values, navigation } = browser(t);
  values.set("mockly:user", "JK");
  navigateAsUser(null);
  assert.equal(getRememberedUser(), null);
  assert.deepEqual(navigation, [{
    kind: "replace", path: "/", user: undefined,
    cookie: "mockly_user=; Path=/; Max-Age=0; SameSite=Lax",
  }]);
});

test("blocked browser storage still updates the server preference and navigates", (t) => {
  const { navigation } = browser(t, true);
  navigateAsUser("JK");
  assert.equal(getRememberedUser(), null);
  assert.equal(navigation[0].path, "/u/JK");
  assert.match(navigation[0].cookie, /^mockly_user=JK;/);
  navigateAsUser(null);
  assert.equal(navigation[1].path, "/");
  assert.match(navigation[1].cookie, /Max-Age=0/);
});
