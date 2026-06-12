import { For, Match, Show, Switch } from "solid-js";

import { TextEmbed as TextEmbedClass, WebsiteEmbed } from "stoat.js";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { Markdown } from "@revolt/markdown";
import { RenderAnchor } from "@revolt/markdown/plugins/anchors";
import { useModals } from "@revolt/modal";
import { Text } from "@revolt/ui/components/design";
import { Column } from "@revolt/ui/components/layout";
import { OverflowingText, SizedContent } from "@revolt/ui/components/utils";

import { Attachment } from "./Attachment";
import { SpecialEmbed } from "./SpecialEmbed";

const Base = styled("div", {
  base: {
    width: "fit-content",

    display: "flex",
    maxWidth: "calc(min(100%, 420px))",
    flexDirection: "row",
    gap: "var(--gap-md)",
    padding: "var(--gap-md)",
    borderRadius: "var(--borderRadius-md)",
    color: "var(--md-sys-color-on-primary-container)",
    background: "var(--md-sys-color-primary-container)",
    borderInlineStart: "var(--gap-sm) solid var(--md-sys-color-primary)",
  },
});

const SiteInformation = styled("div", {
  base: {
    display: "flex",
    flexDirection: "row",
    gap: "var(--gap-md)",
  },
});

const Favicon = styled("img", {
  base: {
    width: "14px",
    height: "14px",
    flexShrink: 0,
  },
});

const PreviewImage = styled("img", {
  base: {
    maxWidth: "120px",
    maxHeight: "120px",
    borderRadius: "var(--borderRadius-md)",
  },
});

const AuthorIcon = styled("img", {
  base: {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    flexShrink: 0,
  },
});

const FooterIcon = styled("img", {
  base: {
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    flexShrink: 0,
  },
});

const Title = styled("span", {
  base: {
    minWidth: 0,
    flexShrink: 1,

    fontSize: "16px",
    color: "var(--md-sys-color-primary) !important",
  },
});

const Content = styled(Column, {
  base: {
    minWidth: 0,
  },
});

const Description = styled("div", {
  base: {
    fontSize: "12px",
    overflow: "hidden",
    wordWrap: "break-word",
  },
});

const FieldGrid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "var(--gap-md)",
  },
});

const Field = styled("div", {
  base: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-xs)",
    fontSize: "12px",
    wordBreak: "break-word",
  },
  variants: {
    inline: {
      false: {
        gridColumn: "1 / -1",
      },
    },
  },
});

const FieldName = styled("span", {
  base: {
    fontWeight: 700,
  },
});

const EmbedImage = styled("img", {
  base: {
    maxWidth: "100%",
    maxHeight: "320px",
    borderRadius: "var(--borderRadius-md)",
    objectFit: "contain",
  },
});

const Footer = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    fontSize: "12px",
    opacity: 0.8,
    minWidth: 0,
  },
});

function formatEmbedTimestamp(timestamp: Date) {
  if (Number.isNaN(timestamp.getTime())) return undefined;

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(timestamp);
}

/**
 * Text Embed
 */
export function TextEmbed(props: { embed: TextEmbedClass | WebsiteEmbed }) {
  const { openModal } = useModals();
  const textEmbed = () =>
    props.embed.type === "Text" ? (props.embed as TextEmbedClass) : undefined;
  const formattedTimestamp = () => {
    const timestamp = textEmbed()?.timestamp;
    return timestamp && formatEmbedTimestamp(timestamp);
  };

  return (
    <Base
      style={{ "border-color": props.embed.colour ?? textEmbed()?.colorHex }}
    >
      <Content gap="md" grow>
        <Show when={textEmbed()?.author}>
          <SiteInformation>
            <Show when={textEmbed()!.author!.icon_url}>
              <AuthorIcon
                loading="lazy"
                draggable={false}
                src={textEmbed()!.proxiedAuthorIconURL}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </Show>
            <RenderAnchor href={textEmbed()!.author!.url}>
              <OverflowingText>
                <Text class="label" size="small">
                  {textEmbed()!.author!.name}
                </Text>
              </OverflowingText>
            </RenderAnchor>
          </SiteInformation>
        </Show>

        <Show when={textEmbed()?.provider?.name}>
          <SiteInformation>
            <RenderAnchor href={textEmbed()!.provider!.url}>
              <OverflowingText>
                <Text class="label" size="small">
                  {textEmbed()!.provider!.name}
                </Text>
              </OverflowingText>
            </RenderAnchor>
          </SiteInformation>
        </Show>

        <Show
          when={
            props.embed.type === "Website" &&
            (props.embed as WebsiteEmbed).siteName
          }
        >
          <SiteInformation>
            <Show when={props.embed.iconUrl}>
              <Favicon
                loading="lazy"
                draggable={false}
                src={props.embed.proxiedIconURL}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </Show>
            <OverflowingText>
              <Text class="label" size="small">
                {(props.embed as WebsiteEmbed).siteName}
              </Text>
            </OverflowingText>
          </SiteInformation>
        </Show>

        <Show when={props.embed.title}>
          <RenderAnchor href={props.embed.url}>
            <Title>
              <OverflowingText>{props.embed.title}</OverflowingText>
            </Title>
          </RenderAnchor>
        </Show>

        <Show when={props.embed.description}>
          <Description>
            <Switch fallback={props.embed.description}>
              <Match when={props.embed.type === "Text"}>
                <Markdown content={props.embed.description!} />
              </Match>
            </Switch>
          </Description>
        </Show>

        <Show
          when={
            props.embed.type === "Text" && (props.embed as TextEmbedClass).media
          }
        >
          <Attachment file={(props.embed as TextEmbedClass).media!} />
        </Show>

        <Show when={textEmbed()?.fields?.length}>
          <FieldGrid>
            <For each={textEmbed()!.fields}>
              {(field) => (
                <Field inline={field.inline ?? false}>
                  <FieldName>{field.name}</FieldName>
                  <Markdown content={field.value} />
                </Field>
              )}
            </For>
          </FieldGrid>
        </Show>

        <Show when={textEmbed()?.image}>
          <EmbedImage src={textEmbed()!.proxiedImageURL} loading="lazy" />
        </Show>

        <Show when={textEmbed()?.video}>
          <SizedContent
            width={textEmbed()!.video!.width ?? 1280}
            height={textEmbed()!.video!.height ?? 720}
          >
            <video
              controls
              preload="metadata"
              src={textEmbed()!.proxiedVideoURL}
            />
          </SizedContent>
        </Show>

        <Show when={props.embed.type === "Website"}>
          <Switch>
            <Match
              when={
                (props.embed as WebsiteEmbed).specialContent?.type &&
                (props.embed as WebsiteEmbed).specialContent?.type !== "None"
              }
            >
              <SpecialEmbed embed={props.embed as WebsiteEmbed} />
            </Match>
            <Match when={(props.embed as WebsiteEmbed).video}>
              <SizedContent
                width={(props.embed as WebsiteEmbed).video!.width}
                height={(props.embed as WebsiteEmbed).video!.height}
              >
                <video
                  controls
                  preload="metadata"
                  src={(props.embed as WebsiteEmbed).video!.proxiedURL}
                />
              </SizedContent>
            </Match>
            <Match when={(props.embed as WebsiteEmbed).image?.size === "Large"}>
              <SizedContent
                width={(props.embed as WebsiteEmbed).image!.width}
                height={(props.embed as WebsiteEmbed).image!.height}
              >
                <img
                  src={(props.embed as WebsiteEmbed).image!.proxiedURL}
                  loading="lazy"
                  class={css({ cursor: "pointer" })}
                  onClick={() =>
                    openModal({
                      type: "image_viewer",
                      embed: (props.embed as WebsiteEmbed).image!,
                    })
                  }
                />
              </SizedContent>
            </Match>
          </Switch>
        </Show>

        <Show when={textEmbed()?.footer || formattedTimestamp()}>
          <Footer>
            <Show when={textEmbed()?.footer?.icon_url}>
              <FooterIcon
                loading="lazy"
                draggable={false}
                src={textEmbed()!.proxiedFooterIconURL}
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </Show>
            <Show when={textEmbed()?.footer}>
              <span>{textEmbed()!.footer!.text}</span>
            </Show>
            <Show when={textEmbed()?.footer && formattedTimestamp()}>
              <span>•</span>
            </Show>
            <Show when={formattedTimestamp()}>
              <time
                dateTime={textEmbed()!.timestamp!.toISOString()}
                title={textEmbed()!.timestamp!.toISOString()}
              >
                {formattedTimestamp()}
              </time>
            </Show>
          </Footer>
        </Show>
      </Content>

      <Show
        when={
          props.embed.type === "Website" &&
          (props.embed as WebsiteEmbed).image?.size === "Preview" &&
          !(props.embed as WebsiteEmbed).video
        }
      >
        <PreviewImage
          src={(props.embed as WebsiteEmbed).image!.proxiedURL}
          loading="lazy"
        />
      </Show>
      <Show when={textEmbed()?.thumbnail}>
        <PreviewImage src={textEmbed()!.proxiedThumbnailURL} loading="lazy" />
      </Show>
    </Base>
  );
}
