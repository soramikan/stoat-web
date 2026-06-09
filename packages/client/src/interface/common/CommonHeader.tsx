import { BiRegularChevronLeft, BiRegularChevronRight } from "solid-icons/bi";
import { JSX, Match, Show, Switch } from "solid-js";

import { useLingui } from "@lingui-solid/solid/macro";
import { css } from "styled-system/css";

import { useDevice } from "@revolt/common";
import { useState } from "@revolt/state";
import { LAYOUT_SECTIONS } from "@revolt/state/stores/Layout";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

/**
 * Wrapper for header icons which adds the chevron on the
 * correct side for toggling sidebar (if on desktop) and
 * the hamburger icon to open sidebar (if on mobile).
 */
export function HeaderIcon(props: { children: JSX.Element }) {
  const state = useState();
  const device = useDevice();
  const { t } = useLingui();
  const primarySidebarOpen = () =>
    state.layout.getSectionState(LAYOUT_SECTIONS.PRIMARY_SIDEBAR, true);
  const togglePrimarySidebar = () =>
    state.layout.toggleSectionState(LAYOUT_SECTIONS.PRIMARY_SIDEBAR, true);

  return (
    <div
      class={`${container} app-header-menu-button`}
      role="button"
      tabIndex={0}
      aria-label={t`Toggle main sidebar`}
      aria-expanded={primarySidebarOpen()}
      onClick={togglePrimarySidebar}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          togglePrimarySidebar();
        }
      }}
      use:floating={{
        tooltip: {
          placement: "bottom",
          content: t`Toggle main sidebar`,
        },
      }}
    >
      <Switch fallback={<BiRegularChevronRight size={20} />}>
        <Match when={primarySidebarOpen()}>
          <BiRegularChevronLeft size={20} />
        </Match>
        <Match when={device.layout() === "phone"}>
          <Symbol size={22}>menu</Symbol>
        </Match>
      </Switch>
      <Show when={device.layout() !== "phone" || primarySidebarOpen()}>
        {props.children}
      </Show>
    </div>
  );
}

const container = css({
  display: "flex",
  cursor: "pointer",
  alignItems: "center",
});
