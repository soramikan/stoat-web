import { Component, JSX, Match, Show, Switch, createMemo } from "solid-js";

import { useLingui } from "@lingui-solid/solid/macro";
import { Channel, Server as ServerI } from "stoat.js";

import {
  CategoryContextMenu,
  ChannelContextMenu,
  ServerSidebarContextMenu,
} from "@revolt/app";
import { useClient, useUser } from "@revolt/client";
import { useDevice } from "@revolt/common";
import { useModals } from "@revolt/modal";
import { useLocation, useParams, useSmartParams } from "@revolt/routing";
import { useState } from "@revolt/state";
import { LAYOUT_SECTIONS } from "@revolt/state/stores/Layout";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { HomeSidebar, ServerList, ServerSidebar } from "./navigation";

/**
 * Left-most channel navigation sidebar
 */
export const Sidebar = (props: {
  /**
   * Menu generator TODO FIXME: remove
   */
  menuGenerator: (t: ServerI | Channel) => JSX.Directives["floating"];
}) => {
  const user = useUser();
  const state = useState();
  const client = useClient();
  const { openModal } = useModals();
  const device = useDevice();
  const { t } = useLingui();

  const params = useParams<{ server: string }>();
  const location = useLocation();

  const primarySidebarOpen = createMemo(
    () =>
      state.layout.getSectionState(LAYOUT_SECTIONS.PRIMARY_SIDEBAR, true) &&
      !location.pathname.startsWith("/discover"),
  );

  const closePrimarySidebar = () =>
    state.layout.setSectionState(LAYOUT_SECTIONS.PRIMARY_SIDEBAR, false, true);

  return (
    <div
      class="app-sidebar-shell"
      data-primary-open={primarySidebarOpen() ? "true" : "false"}
      style={{ display: "flex", "flex-shrink": 0 }}
    >
      <Show when={device.layout() === "phone" && primarySidebarOpen()}>
        <button
          type="button"
          class="app-sidebar-scrim"
          aria-hidden="true"
          tabIndex={-1}
          onClick={closePrimarySidebar}
        />
        <button
          type="button"
          class="app-sidebar-close"
          aria-label={t`Close`}
          onClick={closePrimarySidebar}
        >
          <Symbol size={24}>close</Symbol>
        </button>
      </Show>
      <ServerList
        orderedServers={state.ordering.orderedServers(client())}
        setServerOrder={state.ordering.setServerOrder}
        unreadConversations={state.ordering
          .orderedConversations(client())
          .filter(
            // TODO: muting channels
            (channel) => channel.unread,
          )}
        user={user()!}
        selectedServer={() => params.server}
        onCreateOrJoinServer={() =>
          openModal({
            type: "create_or_join_server",
            client: client(),
          })
        }
        menuGenerator={props.menuGenerator}
      />
      <Show when={primarySidebarOpen()}>
        <Switch fallback={<Home />}>
          <Match when={params.server}>
            <Server />
          </Match>
        </Switch>
      </Show>
    </div>
  );
};

/**
 * Render sidebar for home
 */
const Home: Component = () => {
  const params = useSmartParams();
  const client = useClient();
  const state = useState();
  const conversations = createMemo(() =>
    state.ordering.orderedConversations(client()),
  );

  return (
    <HomeSidebar
      conversations={conversations}
      channelId={params().channelId}
      openSavedNotes={(navigate) => {
        // Check whether the saved messages channel exists already
        const channelId = [...client()!.channels.values()].find(
          (channel) => channel.type === "SavedMessages",
        )?.id;

        if (navigate) {
          if (channelId) {
            // Navigate if exists
            navigate(`/channel/${channelId}`);
          } else {
            // If not, try to create one but only if navigating
            client()!
              .user!.openDM()
              .then((channel) => navigate(`/channel/${channel.id}`));
          }
        }

        // Otherwise return channel ID if available
        return channelId;
      }}
    />
  );
};

/**
 * Render sidebar for a server
 */
const Server: Component = () => {
  const { openModal } = useModals();
  const params = useSmartParams();
  const client = useClient();

  /**
   * Resolve the server
   * @returns Server
   */
  const server = () => client()!.servers.get(params().serverId!)!;

  /**
   * Open the server information modal
   */
  function openServerInfo() {
    openModal({
      type: "server_info",
      server: server(),
    });
  }

  /**
   * Open the server settings modal
   */
  function openServerSettings() {
    openModal({
      type: "settings",
      config: "server",
      context: server(),
    });
  }

  return (
    <Show when={server()}>
      <ServerSidebar
        server={server()}
        channelId={params().channelId}
        openServerInfo={openServerInfo}
        openServerSettings={openServerSettings}
        menuGenerator={(target) => ({
          contextMenu: () =>
            target instanceof Channel ? (
              <ChannelContextMenu channel={target} />
            ) : target instanceof ServerI ? (
              <ServerSidebarContextMenu server={target} />
            ) : (
              <CategoryContextMenu server={server()} category={target} />
            ),
        })}
      />
    </Show>
  );
};
