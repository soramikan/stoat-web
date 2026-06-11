import {
  type Setter,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Match,
  Show,
  Switch,
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

type LimitRow = {
  id: string;
  tag: string;
  value: string;
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

const PERMISSION_LABELS: Record<string, string> = {
  manage_admin: "Manage admin settings",
  manage_users: "Manage users",
  manage_servers: "Manage servers",
  manage_upload_limits: "Manage upload limits",
  create_servers: "Create servers",
};

const pane = css({
  display: "grid",
  gap: "12px",
});

const section = css({
  display: "grid",
  gap: "12px",
  border: "1px solid var(--md-sys-color-outline-variant)",
  borderRadius: "8px",
  padding: "12px",
  background: "var(--md-sys-color-surface-container)",
});

const sectionHeader = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "8px",
});

const formGrid = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "10px",
});

const input = css({
  border: "1px solid var(--md-sys-color-outline-variant)",
  borderRadius: "8px",
  padding: "8px 10px",
  color: "var(--md-sys-color-on-surface)",
  background: "var(--md-sys-color-surface-container)",
  minWidth: 0,
});

const inputCompact = css({
  border: "1px solid var(--md-sys-color-outline-variant)",
  borderRadius: "8px",
  padding: "8px 10px",
  color: "var(--md-sys-color-on-surface)",
  background: "var(--md-sys-color-surface-container-low)",
  minWidth: 0,
  width: "100%",
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

const helper = css({
  fontSize: "12px",
  lineHeight: 1.4,
  color: "var(--md-sys-color-on-surface-variant)",
});

const permissionGrid = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "6px",
});

const limitRow = css({
  display: "grid",
  gridTemplateColumns: "minmax(120px, 1fr) minmax(96px, 140px) auto",
  alignItems: "center",
  gap: "8px",
});

const actions = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
});

const emptyState = css({
  border: "1px dashed var(--md-sys-color-outline-variant)",
  borderRadius: "8px",
  padding: "12px",
  color: "var(--md-sys-color-on-surface-variant)",
});

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

let nextLimitRowId = 0;

function newLimitRow(tag = "", value: string | number = ""): LimitRow {
  return {
    id: `limit-${nextLimitRowId++}`,
    tag,
    value: value.toString(),
  };
}

function limitRowsFromRecord(record: Record<string, number> = {}) {
  return Object.entries(record)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, value]) => newLimitRow(tag, value));
}

function limitRowsToRecord(rows: LimitRow[]) {
  const record: Record<string, number> = {};

  for (const row of rows) {
    const tag = row.tag.trim();
    const value = Number(row.value);

    if (!tag || !Number.isFinite(value) || value < 0) continue;
    record[tag] = value;
  }

  return record;
}

function toggleValue(
  setter: Setter<string[]>,
  value: string,
  checked: boolean,
) {
  setter((current) => {
    if (checked) return Array.from(new Set([...current, value]));
    return current.filter((item) => item !== value);
  });
}

function PermissionChecklist(props: {
  value: () => string[];
  setValue: Setter<string[]>;
}) {
  return (
    <div class={permissionGrid}>
      <For each={ADMIN_PERMISSIONS}>
        {(permission) => (
          <Checkbox
            checked={props.value().includes(permission)}
            onChange={(event) =>
              toggleValue(
                props.setValue,
                permission,
                event.currentTarget.checked,
              )
            }
          >
            {PERMISSION_LABELS[permission] ?? permission}
          </Checkbox>
        )}
      </For>
    </div>
  );
}

function RoleChecklist(props: {
  roles: () => Record<string, AdminRole>;
  value: () => string[];
  setValue: Setter<string[]>;
}) {
  const entries = () => Object.entries(props.roles());

  return (
    <Show
      when={entries().length}
      fallback={<div class={emptyState}>No roles have been created.</div>}
    >
      <div class={permissionGrid}>
        <For each={entries()}>
          {([roleId, role]) => (
            <Checkbox
              checked={props.value().includes(roleId)}
              onChange={(event) =>
                toggleValue(props.setValue, roleId, event.currentTarget.checked)
              }
            >
              {role.name} ({roleId})
            </Checkbox>
          )}
        </For>
      </div>
    </Show>
  );
}

function UploadLimitEditor(props: {
  rows: () => LimitRow[];
  setRows: Setter<LimitRow[]>;
}) {
  return (
    <Column gap="sm">
      <Show
        when={props.rows().length}
        fallback={<div class={emptyState}>No upload limits configured.</div>}
      >
        <For each={props.rows()}>
          {(row) => (
            <div class={limitRow}>
              <input
                class={inputCompact}
                placeholder="Tag"
                value={row.tag}
                onInput={(event) =>
                  props.setRows((rows) =>
                    rows.map((item) =>
                      item.id === row.id
                        ? { ...item, tag: event.currentTarget.value }
                        : item,
                    ),
                  )
                }
              />
              <input
                class={inputCompact}
                placeholder="Bytes"
                type="number"
                min={0}
                value={row.value}
                onInput={(event) =>
                  props.setRows((rows) =>
                    rows.map((item) =>
                      item.id === row.id
                        ? { ...item, value: event.currentTarget.value }
                        : item,
                    ),
                  )
                }
              />
              <Button
                size="sm"
                variant="outlined"
                onPress={() =>
                  props.setRows((rows) =>
                    rows.filter((item) => item.id !== row.id),
                  )
                }
              >
                Remove
              </Button>
            </div>
          )}
        </For>
      </Show>
      <Row>
        <Button
          size="sm"
          variant="tonal"
          onPress={() => props.setRows((rows) => [...rows, newLimitRow()])}
        >
          Add limit
        </Button>
      </Row>
    </Column>
  );
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

  const [creationRestricted, setCreationRestricted] = createSignal(false);
  const [creationUsers, setCreationUsers] = createSignal("");
  const [creationRoles, setCreationRoles] = createSignal("");
  const [defaultLimitRows, setDefaultLimitRows] = createSignal<LimitRow[]>([]);

  const [editingRoleId, setEditingRoleId] = createSignal<string>();
  const [roleId, setRoleId] = createSignal("");
  const [roleName, setRoleName] = createSignal("");
  const [rolePermissions, setRolePermissions] = createSignal<string[]>([]);
  const [roleLimitRows, setRoleLimitRows] = createSignal<LimitRow[]>([]);

  const [selectedUserId, setSelectedUserId] = createSignal<string>();
  const [userRoles, setUserRoles] = createSignal<string[]>([]);
  const [userPermissions, setUserPermissions] = createSignal<string[]>([]);
  const [userLimitRows, setUserLimitRows] = createSignal<LimitRow[]>([]);

  const selectedUser = createMemo(() =>
    users()?.find((entry) => entry.user._id === selectedUserId()),
  );

  createEffect(() => {
    const value = settings();
    if (!value) return;

    setCreationRestricted(value.server_creation?.restricted ?? false);
    setCreationUsers((value.server_creation?.allowed_users ?? []).join(","));
    setCreationRoles((value.server_creation?.allowed_roles ?? []).join(","));
    setDefaultLimitRows(limitRowsFromRecord(value.default_upload_limits ?? {}));
  });

  async function refreshAll() {
    await Promise.all([refetchSettings(), refetchUsers(), refetchServers()]);
  }

  async function putSettings(next: AdminSettings) {
    await adminRequest("PUT", "/admin/settings", { settings: next });
    setStatus(t`Saved`);
    await refreshAll();
  }

  async function savePlatformSettings() {
    const current = settings() ?? DEFAULT_SETTINGS;
    const next: AdminSettings = {
      ...current,
      _id: "global",
      default_upload_limits: limitRowsToRecord(defaultLimitRows()),
      server_creation: {
        restricted: creationRestricted(),
        allowed_users: splitCsv(creationUsers()),
        allowed_roles: splitCsv(creationRoles()),
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

  function editUserOverride(user: AdminUserEntry) {
    const current = settings() ?? DEFAULT_SETTINGS;
    const override = current.users[user.user._id] ?? defaultUserOverride();

    setSelectedUserId(user.user._id);
    setUserRoles([...override.roles]);
    setUserPermissions([...override.permissions]);
    setUserLimitRows(limitRowsFromRecord(override.upload_limits));
  }

  async function saveSelectedUserOverride() {
    const userId = selectedUserId();
    if (!userId) return;

    await saveUserOverride(userId, {
      roles: userRoles(),
      permissions: userPermissions(),
      upload_limits: limitRowsToRecord(userLimitRows()),
    });
  }

  async function clearUserOverride(user: AdminUserEntry) {
    if (!window.confirm(t`Clear this user's admin overrides?`)) return;
    const current = settings() ?? DEFAULT_SETTINGS;
    const users = { ...current.users };
    delete users[user.user._id];
    if (selectedUserId() === user.user._id) setSelectedUserId(undefined);
    await putSettings({ ...current, users });
  }

  function createRole() {
    setEditingRoleId("new");
    setRoleId("");
    setRoleName("");
    setRolePermissions([]);
    setRoleLimitRows([]);
  }

  function editRole(roleId: string, role: AdminRole) {
    setEditingRoleId(roleId);
    setRoleId(roleId);
    setRoleName(role.name);
    setRolePermissions([...role.permissions]);
    setRoleLimitRows(limitRowsFromRecord(role.upload_limits));
  }

  async function saveRole() {
    const id = roleId().trim();
    if (!id) {
      window.alert(t`Role ID is required`);
      return;
    }

    const current = settings() ?? DEFAULT_SETTINGS;
    await putSettings({
      ...current,
      roles: {
        ...current.roles,
        [id]: {
          name: roleName().trim() || id,
          permissions: rolePermissions(),
          upload_limits: limitRowsToRecord(roleLimitRows()),
        },
      },
    });
    setEditingRoleId(undefined);
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
          <Trans>Settings</Trans>
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
          <Column gap="lg">
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
                      <Button size="sm" onPress={() => editUserOverride(entry)}>
                        Admin settings
                      </Button>,
                      <Button
                        size="sm"
                        onPress={() => clearUserOverride(entry)}
                      >
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

            <Show when={selectedUser()}>
              <div class={section}>
                <div class={sectionHeader}>
                  <Column gap="xs">
                    <Text>User admin settings</Text>
                    <div class={helper}>
                      {selectedUser()?.user.username} ·{" "}
                      {selectedUser()?.user._id}
                    </div>
                  </Column>
                  <Button
                    size="sm"
                    variant="text"
                    onPress={() => setSelectedUserId(undefined)}
                  >
                    Close
                  </Button>
                </div>

                <Column gap="sm">
                  <Text>Roles</Text>
                  <RoleChecklist
                    roles={() => settings()?.roles ?? {}}
                    value={userRoles}
                    setValue={setUserRoles}
                  />
                </Column>

                <Column gap="sm">
                  <Text>Permissions</Text>
                  <PermissionChecklist
                    value={userPermissions}
                    setValue={setUserPermissions}
                  />
                </Column>

                <Column gap="sm">
                  <Text>Upload limits</Text>
                  <div class={helper}>
                    Enter byte limits by tag. Empty rows are ignored.
                  </div>
                  <UploadLimitEditor
                    rows={userLimitRows}
                    setRows={setUserLimitRows}
                  />
                </Column>

                <div class={actions}>
                  <Button variant="filled" onPress={saveSelectedUserOverride}>
                    Save user settings
                  </Button>
                  <Button
                    variant="outlined"
                    onPress={() =>
                      selectedUser() && clearUserOverride(selectedUser()!)
                    }
                  >
                    Clear user override
                  </Button>
                </div>
              </div>
            </Show>
          </Column>
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
            <div class={section}>
              <Column gap="xs">
                <Text>Server creation</Text>
                <div class={helper}>
                  Choose who can create servers when creation is restricted.
                </div>
              </Column>

              <Checkbox
                checked={creationRestricted()}
                onChange={(event) =>
                  setCreationRestricted(event.currentTarget.checked)
                }
              >
                Restrict server creation
              </Checkbox>

              <div class={formGrid}>
                <label class={label}>
                  Allowed users
                  <input
                    class={input}
                    placeholder="User IDs, comma separated"
                    value={creationUsers()}
                    onInput={(event) =>
                      setCreationUsers(event.currentTarget.value)
                    }
                  />
                </label>

                <label class={label}>
                  Allowed roles
                  <input
                    class={input}
                    placeholder="Role IDs, comma separated"
                    value={creationRoles()}
                    onInput={(event) =>
                      setCreationRoles(event.currentTarget.value)
                    }
                  />
                </label>
              </div>
            </div>

            <div class={section}>
              <Column gap="xs">
                <Text>Default upload limits</Text>
                <div class={helper}>
                  These limits apply before per-role or per-user upload limits.
                </div>
              </Column>
              <UploadLimitEditor
                rows={defaultLimitRows}
                setRows={setDefaultLimitRows}
              />
            </div>

            <div class={section}>
              <div class={sectionHeader}>
                <Column gap="xs">
                  <Text>Admin roles</Text>
                  <div class={helper}>
                    Create reusable permission sets, then assign them to users.
                  </div>
                </Column>
                <Button variant="tonal" onPress={createRole}>
                  Add role
                </Button>
              </div>

              <Show when={editingRoleId()}>
                <div class={pane}>
                  <div class={formGrid}>
                    <label class={label}>
                      Role ID
                      <input
                        class={input}
                        disabled={editingRoleId() !== "new"}
                        value={roleId()}
                        onInput={(event) =>
                          setRoleId(event.currentTarget.value)
                        }
                      />
                    </label>

                    <label class={label}>
                      Role name
                      <input
                        class={input}
                        value={roleName()}
                        onInput={(event) =>
                          setRoleName(event.currentTarget.value)
                        }
                      />
                    </label>
                  </div>

                  <Column gap="sm">
                    <Text>Permissions</Text>
                    <PermissionChecklist
                      value={rolePermissions}
                      setValue={setRolePermissions}
                    />
                  </Column>

                  <Column gap="sm">
                    <Text>Upload limits</Text>
                    <UploadLimitEditor
                      rows={roleLimitRows}
                      setRows={setRoleLimitRows}
                    />
                  </Column>

                  <div class={actions}>
                    <Button variant="filled" onPress={saveRole}>
                      Save role
                    </Button>
                    <Button
                      variant="outlined"
                      onPress={() => setEditingRoleId(undefined)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </Show>

              <Show
                when={Object.entries(settings()?.roles ?? {}).length}
                fallback={
                  <div class={emptyState}>No roles have been created.</div>
                }
              >
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
                          <Button
                            size="sm"
                            onPress={() => editRole(roleId, role)}
                          >
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
              </Show>
            </div>

            <div class={actions}>
              <Button variant="filled" onPress={savePlatformSettings}>
                <Trans>Save</Trans>
              </Button>
              <Button variant="tonal" onPress={refreshAll}>
                Refresh
              </Button>
            </div>
          </div>
        </Match>
      </Switch>
    </Column>
  );
}
