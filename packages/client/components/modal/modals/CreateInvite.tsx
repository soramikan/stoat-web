import { Show, createSignal, onMount } from "solid-js";

import { Trans } from "@lingui-solid/solid/macro";
import { useMutation } from "@tanstack/solid-query";
import { styled } from "styled-system/jsx";

import { Dialog, DialogProps } from "@revolt/ui";

import { useModals } from "..";
import { Modals } from "../types";

const CANONICAL_INVITE_BASE_URL = "https://chat.setoka.net/invite";

/**
 * Code block which displays invite
 */
const Invite = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",

    "& code": {
      padding: "1em",
      userSelect: "all",
      fontSize: "1.4em",
      textAlign: "center",
      fontFamily: "var(--fonts-monospace)",
    },
  },
});

/**
 * Modal to create a new invite
 */
export function CreateInviteModal(
  props: DialogProps & Modals & { type: "create_invite" },
) {
  const { showError } = useModals();
  const [link, setLink] = createSignal("...");

  const fetchInvite = useMutation(() => ({
    mutationFn: () =>
      props.channel
        .createInvite()
        .then(({ _id }) => setLink(`${CANONICAL_INVITE_BASE_URL}/${_id}`)),
    onError: showError,
  }));

  onMount(() => fetchInvite.mutate());

  return (
    <Dialog
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Create Invite</Trans>}
      actions={[
        { text: <Trans>OK</Trans> },
        {
          text: <Trans>Copy Link</Trans>,
          onClick: () => {
            navigator.clipboard.writeText(link());
            return false;
          },
        },
      ]}
    >
      <Show
        when={!fetchInvite.isPending}
        fallback={<Trans>Generating invite…</Trans>}
      >
        <Invite>
          <Trans>
            Here is your new invite code: <code>{link()}</code>
          </Trans>
        </Invite>
      </Show>
    </Dialog>
  );
}
