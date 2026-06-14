import { Accessor, Show } from "solid-js";

import { Trans } from "@lingui-solid/solid/macro";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";
import { decodeTime } from "ulid";

import { useTime } from "@revolt/i18n";
import { Ripple } from "@revolt/ui/components/design";
import { iconSize } from "@revolt/ui/components/utils";

import MdClose from "@material-design-icons/svg/filled/close.svg?component-solid";

import { FloatingIndicator } from "./FloatingIndicator";

interface Props {
  /**
   * The last Id of the message the user read
   */
  lastId: Accessor<string | undefined>;

  /**
   * Jump back to the last message
   */
  jumpBack: () => void;

  /**
   * Mark all messages in this channel as read
   */
  markRead: () => void | Promise<void>;

  /**
   * Dismiss the message
   */
  dismiss: () => void;
}

/**
 * Component indicating to user there were new messages in chat
 */
export function NewMessages(props: Props) {
  // TODO: hook escape button

  const dayjs = useTime();

  /**
   * Remove the message
   */
  function onCancel(e: MouseEvent) {
    e.stopPropagation();
    props.dismiss();
  }

  /**
   * Mark all messages as read.
   */
  function onMarkRead(e: MouseEvent) {
    e.stopPropagation();
    void props.markRead();
  }

  return (
    <Show when={props.lastId()}>
      <FloatingIndicator position="top" onClick={props.jumpBack}>
        <Ripple />
        <span class={css({ flexGrow: 1 })}>
          <Trans>
            New messages since {dayjs(decodeTime(props.lastId()!)).fromNow()}
          </Trans>
        </span>
        <Action type="button" onClick={onMarkRead}>
          <Trans>Mark as read</Trans>
        </Action>
        <CancelIcon onClick={onCancel}>
          <MdClose {...iconSize(16)} />
        </CancelIcon>
      </FloatingIndicator>
    </Show>
  );
}

const Action = styled("button", {
  base: {
    border: "none",
    padding: 0,
    flexShrink: 0,
    cursor: "pointer",
    color: "inherit",
    font: "inherit",
    fontWeight: 600,
    background: "transparent",
  },
});

const CancelIcon = styled("div", {
  base: {
    height: "16px",
  },
});
