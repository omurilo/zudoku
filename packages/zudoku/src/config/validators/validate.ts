import type { Options } from "@mdx-js/rollup";
import type { ReactNode } from "react";
import type { DevPortalPlugin } from "src/lib/core/plugins.js";
import z from "zod";
import { fromError } from "zod-validation-error";
import { DevPortalContext } from "../../lib/core/DevPortalContext.js";
import type { ApiKey } from "../../lib/plugins/api-keys/index.js";
import type { MdxComponentsType } from "../../lib/util/MdxComponents.js";
import { InputSidebarSchema } from "./InputSidebarSchema.js";

const ThemeSchema = z
  .object({
    background: z.string(),
    foreground: z.string(),
    card: z.string(),
    cardForeground: z.string(),
    popover: z.string(),
    popoverForeground: z.string(),
    primary: z.string(),
    primaryForeground: z.string(),
    secondary: z.string(),
    secondaryForeground: z.string(),
    muted: z.string(),
    mutedForeground: z.string(),
    accent: z.string(),
    accentForeground: z.string(),
    destructive: z.string(),
    destructiveForeground: z.string(),
    border: z.string(),
    input: z.string(),
    ring: z.string(),
    radius: z.string(),
  })
  .partial();

const ApiConfigSchema = z.object({
  server: z.string().optional(),
  navigationId: z.string().optional(),
});

const ApiSchema = z.union([
  z
    .object({ type: z.literal("url"), input: z.string() })
    .merge(ApiConfigSchema),
  z
    .object({ type: z.literal("yaml"), input: z.string() })
    .merge(ApiConfigSchema),
  z
    .object({ type: z.literal("json"), input: z.object({}).passthrough() })
    .merge(ApiConfigSchema),
]);

const ApiKeysSchema = z.union([
  z.object({
    enabled: z.boolean(),
    endpoint: z.string(),
  }),
  z.object({
    enabled: z.boolean(),
    getKeys: z.custom<(context: DevPortalContext) => Promise<ApiKey[]>>(
      (val) => typeof val === "function",
    ),
    rollKey: z
      .custom<
        (id: string, context: DevPortalContext) => Promise<void>
      >((val) => typeof val === "function")
      .optional(),
    deleteKey: z
      .custom<
        (id: string, context: DevPortalContext) => Promise<void>
      >((val) => typeof val === "function")
      .optional(),
    updateKeyDescription: z
      .custom<
        (
          apiKey: { id: string; description: string },
          context: DevPortalContext,
        ) => Promise<void>
      >((val) => typeof val === "function")
      .optional(),
    createKey: z
      .custom<
        (
          apiKey: { description: string; expiresOn?: string },
          context: DevPortalContext,
        ) => Promise<void>
      >((val) => typeof val === "function")
      .optional(),
  }),
]);

const LogoSchema = z.object({
  src: z.object({ light: z.string(), dark: z.string() }),
  alt: z.string().optional(),
  width: z.string().optional(),
});

const ConfigSchema = z
  .object({
    page: z
      .object({
        pageTitle: z.string(),
        logoUrl: z.string(),
        logo: LogoSchema,
      })
      .partial(),
    topNavigation: z.array(
      z.object({
        label: z.string(),
        id: z.string(),
      }),
    ),
    sidebar: z.record(InputSidebarSchema),
    slotlets: z.record(z.string(), z.custom<ReactNode>()),
    theme: z
      .object({
        light: ThemeSchema,
        dark: ThemeSchema,
      })
      .partial(),
    metadata: z
      .object({
        title: z.string(),
        description: z.string(),
        logo: z.string(),
        favicon: z.string(),
        generator: z.string(),
        applicationName: z.string(),
        referrer: z.string(),
        keywords: z.array(z.string()),
        authors: z.array(z.string()),
        creator: z.string(),
        publisher: z.string(),
      })
      .partial(),
    mdx: z
      .object({
        components: z.custom<MdxComponentsType>(),
      })
      .partial(),
    authentication: z.union([
      z.object({
        type: z.literal("clerk"),
        clerkPubKey: z.custom<`pk_test_${string}` | `pk_live_${string}`>(
          (val) =>
            typeof val === "string" ? /^pk_(test|live)_\w+$/.test(val) : false,
        ),
        redirectToAfterSignUp: z.string().optional(),
        redirectToAfterSignIn: z.string().optional(),
        redirectToAfterSignOut: z.string().optional(),
      }),
      z.object({
        type: z.literal("auth0"),
        clientId: z.string(),
        domain: z.string(),
        audience: z.string().optional(),
        redirectToAfterSignUp: z.string().optional(),
        redirectToAfterSignIn: z.string().optional(),
        redirectToAfterSignOut: z.string().optional(),
      }),
    ]),
    search: z.object({
      type: z.literal("inkeep"),
      apiKey: z.string(),
      integrationId: z.string(),
      organizationId: z.string(),
      primaryBrandColor: z.string(),
      organizationDisplayName: z.string(),
    }),
    docs: z
      .object({
        files: z.string(),
        defaultOptions: z
          .object({
            toc: z.boolean(),
            disablePager: z.boolean(),
          })
          .partial(),
      })
      .partial(),
    apis: z.union([ApiSchema, z.array(ApiSchema)]),
    apiKeys: ApiKeysSchema,
    redirects: z.array(z.object({ from: z.string(), to: z.string() })),
    customPages: z.array(
      z.object({
        path: z.string(),
        element: z.custom<NonNullable<ReactNode>>(),
      }),
    ),
    plugins: z.array(z.custom<DevPortalPlugin>()),
    build: z.custom<{
      remarkPlugins?: Options["remarkPlugins"];
      rehypePlugins?: Options["rehypePlugins"];
    }>(),
  })
  .partial()
  .superRefine((config, ctx) => {
    // check if sidebar ids are found in top navigation
    if (!config.sidebar || !config.topNavigation) return;

    const topNavIds = config.topNavigation.map((item) => item.id);

    const nonExistentKeys = Object.keys(config.sidebar).filter(
      (key) => !topNavIds.includes(key),
    );

    if (nonExistentKeys.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Sidebar ID [${nonExistentKeys.map((v) => `"${v}"`).join(", ")}] not found in top navigation.
Following IDs are available: ${topNavIds.join(", ")}`,
      });
    }
  });

export type ZudokuConfig = z.infer<typeof ConfigSchema>;

export function validateConfig(config: unknown) {
  const validationResult = ConfigSchema.safeParse(config);

  if (!validationResult.success) {
    // eslint-disable-next-line no-console
    console.log("Validation errors:");
    // eslint-disable-next-line no-console
    console.log(fromError(validationResult.error).toString());
  }
}