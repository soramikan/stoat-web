import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createResource,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui-solid/solid/macro";
import type { API } from "stoat.js";
import { css } from "styled-system/css";

import { useClient } from "@revolt/client";
import { CONFIGURATION } from "@revolt/common";
import {
  Button,
  CategoryButton,
  Checkbox,
  Column,
  Row,
  Text,
} from "@revolt/ui";

type AdminRole = {
  name: string;
  permissions: string[];
  upload_limits: Record<string, number>;
};

type AdminUserOverride = {
  roles: string[];
  permissions: string[];
  upload_limits: Record<string, number>;
};

type AdminServerOverride = {
  frozen: boolean;
  timeout_until?: string;
};

type AdminSettings = {
  _id: string;
  roles: Record<string, AdminRole>;
  users: Record<string, AdminUserOverride>;
  servers: Record<string, AdminServerOverride>;
  default_upload_limits: Record<string, number>;
  server_creation: {
    restricted: boolean;
    allowed_users: string[];
    allowed_roles: string[];
  };
};

type AdminUserEntry = {
  user: API.User;
  default_admin: boolean;
  permissions: string[];
};

type AdminServerEntry = {
  server: API.Server;
  state?: AdminServerOverride;
};

const DEFAULT_SETTINGS: AdminSettings = {
  _id: "global",
  roles: {},
  users: {},
  servers: {},
  default_upload_limits: {},
  server_creation: {
    restricted: false,
    allowed_users: [],
    allowed_roles: [],
  },
};

const ADMIN_PERMISSIONS = [
  "manage_admin",
  "manage_users",
  "manage_servers",
  "manage_upload_limits",
  "create_servers",
];

const pane = css({
  display: "grid",
  gap: "12px",
});

const editor = css({
  width: "100%",
  minHeight: "180px",
  resize: "vertical",
  border: "1px solid var(--md-sys-color-outline-variant)",
  borderRadius: "8px",
  padding: "12px",
  color: "var(--md-sys-color-on-surface)",
  background: "var(--md-sys-color-surface-container)",
  fontFamily: "var(--fonts-monospace)",
  fontSize: "13px",
  lineHeight: 1.45,
});

const input = css({
  border: "1px solid var(--md-sys-color-outline-variant)",
  borderRadius: "8px",
  padding: "8px 10px",
  color: "var(--md-sys-color-on-surface)",
  background: "var(--md-sys-color-surface-container)",
  minWidth: 0,
});

const tabs = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
});

const label = css({
  display: "grid",
  gap: "6px",
  fontSize: "13px",
  color: "var(--md-sys-color-on-surface-variant)",
});

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseJson<T>(value: string, fallback: T): T {
  if (!value.trim()) return fallback;
  return JSON.parse(value) as T;
}

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultUserOverride(): AdminUserOverride {
  return {
    roles: [],
    permissions: [],
    upload_limits: {},
  };
}

export default function AdminPanel() {
  const { t } = useLingui();
  const client = useClient();
  const [tab, setTab] = createSignal<"users" | "servers" | "settings">("users");
  const [status, setStatus] = createSignal("");

  async function adminRequest<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const [authHeader, authHeaderValue] = client().authenticationHeader;
    const response = await fetch(`${CONFIGURATION.DEFAULT_API_URL}${path}`, {
      method,
      headers: {
        [authHeader]: authHeaderValue,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  const [settings, { refetch: refetchSettings }] =
    createResource<AdminSettings>(() => adminRequest("GET", "/admin/settings"));
  const [users, { refetch: refetchUsers }] = createResource<AdminUserEntry[]>(
    () => adminRequest("GET", "/admin/users"),
  );
  const [servers, { refetch: refetchServers }] = createResource<
    AdminServerEntry[]
  >(() => adminRequest("GET", "/admin/servers"));

  const [rolesJson, setRolesJson] = createSignal("{}");
  const [usersJson, setUsersJson] = createSignal("{}");
  const [uploadJson, setUploadJson] = createSignal("{}");
  const [creationRestricted, setCreationRestricted] = createSignal(false);
  const [creationUsers, setCreationUsers] = createSignal("");
  const [creationRoles, setCreationRoles] = createSignal("");

  createEffect(() => {
    const value = settings();
    if (!value) return;

    setRolesJson(pretty(value.roles ?? {}));
    setUsersJson(pretty(value.users ?? {}));
    setUploadJson(pretty(value.default_upload_limits ?? {}));
    setCreationRestricted(value.server_creation?.restricted ?? false);
    setCreationUsers((value.server_creation?.allowed_users ?? []).join(","));
    setCreationRoles((value.server_creation?.allowed_roles ?? []).join(","));
  });

  async function refreshAll() {
    await Promise.all([refetchSettings(), refetchUsers(), refetchServers()]);
  }

  async function putSettings(next: AdminSettings) {
    await adminRequest("PUT", "/admin/settings", { settings: next });
    setStatus(t`Saved`);
    await refreshAll();
  }

  async function saveSettings() {
    const current = settings() ?? DEFAULT_SETTINGS;
    const next: AdminSettings = {
      ...current,
      _id: "global",
      roles: parseJson(rolesJson(), {}),
      users: parseJson(usersJson(), {}),
      default_upload_limits: parseJson(uploadJson(), {}),
      server_creation: {
        restricted: creationRestricted(),
        allowed_users: creationUsers()
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        allowed_roles: creationRoles()
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      },
    };

    await putSettings(next);
  }

  async function saveUserOverride(userId: string, override: AdminUserOverride) {
    const current = settings() ?? DEFAULT_SETTINGS;
    await putSettings({
      ...current,
      users: {
        ...current.users,
        [userId]: override,
      },
    });
  }

  async function editUserRoles(user: AdminUserEntry) {
    const current = settings() ?? DEFAULT_SETTINGS;
    const override = current.users[user.user._id] ?? defaultUserOverride();
    const roles = window.prompt(t`Roles`, override.roles.join(","));
    if (roles === null) return;

    await saveUserOverride(user.user._id, {
      ...override,
      roles: splitCsv(roles),
    });
  }

  async function editUserPermissions(user: AdminUserEntry) {
    const current = settings() ?? DEFAULT_SETTINGS;
    const override = current.users[user.user._id] ?? defaultUserOverride();
    const permissions = window.prompt(
      t`Permissions`,
      override.permissions.join(","),
    );
    if (permissions === null) return;

    await saveUserOverride(user.user._id, {
      ...override,
      permissions: splitCsv(permissions),
    });
  }

  async function editUserUploadLimits(user: AdminUserEntry) {
    const current = settings() ?? DEFAULT_SETTINGS;
    const override = current.users[user.user._id] ?? defaultUserOverride();
    const uploadLimits = window.prompt(
      t`Upload limits`,
      pretty(override.upload_limits),
    );
    if (uploadLimits === null) return;

    await saveUserOverride(user.user._id, {
      ...override,
      upload_limits: parseJson(uploadLimits, {}),
    });
  }

  async function clearUserOverride(user: AdminUserEntry) {
    if (!window.confirm(t`Clear this user's admin overrides?`)) return;
    const current = settings() ?? DEFAULT_SETTINGS;
    const users = { ...current.users };
    delete users[user.user._id];
    await putSettings({ ...current, users });
  }

  async function createRole() {
    const id = window.prompt(t`Role ID`);
    if (!id) return;

    const current = settings() ?? DEFAULT_SETTINGS;
    const name = window.prompt(t`Role name`, id);
    if (name === null) return;

    const permissions = window.prompt(t`Permissions`, "");
    if (permissions === null) return;

    const uploadLimits = window.prompt(t`Upload limits`, "{}");
    if (uploadLimits === null) return;

    await putSettings({
      ...current,
      roles: {
        ...current.roles,
        [id]: {
          name,
          permissions: splitCsv(permissions),
          upload_limits: parseJson(uploadLimits, {}),
        },
      },
    });
  }

  async function editRole(roleId: string, role: AdminRole) {
    const name = window.prompt(t`Role name`, role.name);
    if (name === null) return;

    const permissions = window.prompt(
      t`Permissions`,
      role.permissions.join(","),
    );
    if (permissions === null) return;

    const uploadLimits = window.prompt(
      t`Upload limits`,
      pretty(role.upload_limits),
    );
    if (uploadLimits === null) return;

    const current = settings() ?? DEFAULT_SETTINGS;
    await putSettings({
      ...current,
      roles: {
        ...current.roles,
        [roleId]: {
          name,
          permissions: splitCsv(permissions),
          upload_limits: parseJson(uploadLimits, {}),
        },
      },
    });
  }

  async function deleteRole(roleId: string) {
    if (!window.confirm(t`Delete this role?`)) return;
    const current = settings() ?? DEFAULT_SETTINGS;
    const roles = { ...current.roles };
    delete roles[roleId];

    const users: Record<string, AdminUserOverride> = {};
    for (const [userId, override] of Object.entries(current.users)) {
      users[userId] = {
        ...override,
        roles: override.roles.filter((role) => role !== roleId),
      };
    }

    await putSettings({ ...current, roles, users });
  }

  async function renameUser(user: AdminUserEntry) {
    const username = window.prompt(t`Username`, user.user.username);
    if (!username || username === user.user.username) return;
    await adminRequest("PATCH", `/admin/users/${user.user._id}/username`, {
      username,
    });
    await refetchUsers();
  }

  async function suspendUser(user: AdminUserEntry) {
    const days = window.prompt(t`Duration days`, "7");
    if (days === null) return;
    await adminRequest("POST", `/admin/users/${user.user._id}/suspend`, {
      duration_days: days ? Number(days) : undefined,
      reason: [],
    });
    await refetchUsers();
  }

  async function unsuspendUser(user: AdminUserEntry) {
    await adminRequest("POST", `/admin/users/${user.user._id}/unsuspend`);
    await refetchUsers();
  }

  async function resetPassword(user: AdminUserEntry) {
    const response = await adminRequest<{ token: string; expires_at: string }>(
      "POST",
      `/admin/users/${user.user._id}/password-reset`,
    );
    window.alert(
      `${t`Reset token`}: ${response.token}\n${t`Expires`}: ${response.expires_at}`,
    );
  }

  async function deleteUser(user: AdminUserEntry) {
    if (!window.confirm(t`Delete ${user.user.username}?`)) return;
    await adminRequest("DELETE", `/admin/users/${user.user._id}`);
    await refetchUsers();
  }

  async function freezeServer(server: AdminServerEntry) {
    const until = window.prompt(t`Timeout until ISO timestamp`, "");
    await adminRequest("POST", `/admin/servers/${server.server._id}/freeze`, {
      timeout_until: until || undefined,
    });
    await refetchServers();
  }

  async function unfreezeServer(server: AdminServerEntry) {
    await adminRequest("POST", `/admin/servers/${server.server._id}/unfreeze`);
    await refetchServers();
  }

  async function deleteServer(server: AdminServerEntry) {
    if (!window.confirm(t`Delete ${server.server.name}?`)) return;
    await adminRequest("DELETE", `/admin/servers/${server.server._id}`);
    await refetchServers();
  }

  return (
    <Column gap="xl">
      <Row class={tabs}>
        <Button
          variant={tab() === "users" ? "filled" : "tonal"}
          onPress={() => setTab("users")}
        >
          <Trans>Users</Trans>
        </Button>
        <Button
          variant={tab() === "servers" ? "filled" : "tonal"}
          onPress={() => setTab("servers")}
        >
          <Trans>Servers</Trans>
        </Button>
        <Button
          variant={tab() === "settings" ? "filled" : "tonal"}
          onPress={() => setTab("settings")}
        >
          <Trans>Roles</Trans>
        </Button>
      </Row>

      <Show when={status()}>
        <Text>{status()}</Text>
      </Show>

      <Switch fallback={<Text>Loading...</Text>}>
        <Match when={settings.error || users.error || servers.error}>
          <Text>Not available.</Text>
        </Match>

        <Match when={tab() === "users"}>
          <CategoryButton.Group>
            <For each={users()}>
              {(entry) => (
                <CategoryButton
                  description={
                    <>
                      {entry.user._id}
                      <Show when={entry.default_admin}> · Default admin</Show>
                      <Show when={entry.permissions.length}>
                        {" "}
                        · {entry.permissions.join(", ")}
                      </Show>
                    </>
                  }
                  action={[
                    <Button size="sm" onPress={() => editUserRoles(entry)}>
                      Roles
                    </Button>,
                    <Button
                      size="sm"
                      onPress={() => editUserPermissions(entry)}
                    >
                      Permissions
                    </Button>,
                    <Button
                      size="sm"
                      onPress={() => editUserUploadLimits(entry)}
                    >
                      Limits
                    </Button>,
                    <Button size="sm" onPress={() => clearUserOverride(entry)}>
                      Clear
                    </Button>,
                    <Button size="sm" onPress={() => renameUser(entry)}>
                      Rename
                    </Button>,
                    <Button size="sm" onPress={() => suspendUser(entry)}>
                      Suspend
                    </Button>,
                    <Button size="sm" onPress={() => unsuspendUser(entry)}>
                      Unsuspend
                    </Button>,
                    <Button size="sm" onPress={() => resetPassword(entry)}>
                      Reset
                    </Button>,
                    <Button size="sm" onPress={() => deleteUser(entry)}>
                      Delete
                    </Button>,
                  ]}
                >
                  {entry.user.username}
                </CategoryButton>
              )}
            </For>
          </CategoryButton.Group>
        </Match>

        <Match when={tab() === "servers"}>
          <CategoryButton.Group>
            <For each={servers()}>
              {(entry) => (
                <CategoryButton
                  description={
                    <>
                      {entry.server._id} · Owner {entry.server.owner}
                      <Show when={entry.state?.frozen}> · Frozen</Show>
                      <Show when={entry.state?.timeout_until}>
                        {" "}
                        · {entry.state?.timeout_until}
                      </Show>
                    </>
                  }
                  action={[
                    <Button size="sm" onPress={() => freezeServer(entry)}>
                      Freeze
                    </Button>,
                    <Button size="sm" onPress={() => unfreezeServer(entry)}>
                      Unfreeze
                    </Button>,
                    <Button size="sm" onPress={() => deleteServer(entry)}>
                      Delete
                    </Button>,
                  ]}
                >
                  {entry.server.name}
                </CategoryButton>
              )}
            </For>
          </CategoryButton.Group>
        </Match>

        <Match when={tab() === "settings"}>
          <div class={pane}>
            <Checkbox
              checked={creationRestricted()}
              onChange={(event) =>
                setCreationRestricted(event.currentTarget.checked)
              }
            >
              Restrict server creation
            </Checkbox>

            <label class={label}>
              Allowed users
              <input
                class={input}
                value={creationUsers()}
                onInput={(event) => setCreationUsers(event.currentTarget.value)}
              />
            </label>

            <label class={label}>
              Allowed roles
              <input
                class={input}
                value={creationRoles()}
                onInput={(event) => setCreationRoles(event.currentTarget.value)}
              />
            </label>

            <Row>
              <Button variant="tonal" onPress={createRole}>
                Add role
              </Button>
            </Row>

            <Text>Permissions: {ADMIN_PERMISSIONS.join(", ")}</Text>

            <CategoryButton.Group>
              <For each={Object.entries(settings()?.roles ?? {})}>
                {([roleId, role]) => (
                  <CategoryButton
                    description={
                      <>
                        {roleId}
                        <Show when={role.permissions.length}>
                          {" "}
                          · {role.permissions.join(", ")}
                        </Show>
                      </>
                    }
                    action={[
                      <Button size="sm" onPress={() => editRole(roleId, role)}>
                        Edit
                      </Button>,
                      <Button size="sm" onPress={() => deleteRole(roleId)}>
                        Delete
                      </Button>,
                    ]}
                  >
                    {role.name}
                  </CategoryButton>
                )}
              </For>
            </CategoryButton.Group>

            <label class={label}>
              Roles
              <textarea
                class={editor}
                value={rolesJson()}
                onInput={(event) => setRolesJson(event.currentTarget.value)}
              />
            </label>

            <label class={label}>
              User overrides
              <textarea
                class={editor}
                value={usersJson()}
                onInput={(event) => setUsersJson(event.currentTarget.value)}
              />
            </label>

            <label class={label}>
              Default upload limits
              <textarea
                class={editor}
                value={uploadJson()}
                onInput={(event) => setUploadJson(event.currentTarget.value)}
              />
            </label>

            <Row>
              <Button variant="filled" onPress={saveSettings}>
                <Trans>Save</Trans>
              </Button>
              <Button variant="tonal" onPress={refreshAll}>
                Refresh
              </Button>
            </Row>
          </div>
        </Match>
      </Switch>
    </Column>
  );
}
