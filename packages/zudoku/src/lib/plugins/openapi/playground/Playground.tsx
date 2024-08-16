import { useMutation } from "@tanstack/react-query";
import { Fragment, useEffect, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useApiIdentities } from "../../../components/context/ZudokuContext.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/Select.js";
import { Spinner } from "../../../components/Spinner.js";
import { Button } from "../../../ui/Button.js";
import { Card } from "../../../ui/Card.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../ui/Tabs.js";
import { fetchTimeout } from "../../../util/fetchTimeout.js";
import { ColorizedParam } from "../ColorizedParam.js";
import { createUrl } from "./createUrl.js";
import { Headers } from "./Headers.js";
import { PathParams } from "./PathParams.js";
import { QueryParams } from "./QueryParams.js";
import { ResponseTab } from "./ResponseTab.js";

export const NO_IDENTITY = "__none";

function mimeTypeToLanguage(mimeType: string) {
  const mimeTypeMapping = {
    "application/json": "json",
    "text/json": "json",
    "text/html": "html",
    "text/css": "css",
    "text/javascript": "javascript",
    "application/xml": "xml",
    "application/xhtml+xml": "xhtml",
    "text/plain": "plain",
  } as const;

  return Object.entries(mimeTypeMapping).find(([mime]) =>
    mimeType.includes(mime),
  )?.[1];
}

const statusCodeMap: Record<number, string> = {
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  500: "Internal Server Error",
};

export type Header = {
  name: string;
  defaultValue?: string;
};
export type QueryParam = {
  name: string;
  defaultValue?: string;
  defaultActive?: boolean;
  isRequired?: boolean;
};
export type PathParam = {
  name: string;
  defaultValue?: string;
  isRequired?: boolean;
};

export type PlaygroundForm = {
  body: string;
  queryParams: Array<{ name: string; value: string; active: boolean }>;
  pathParams: Array<{ name: string; value: string }>;
  headers: Array<{ name: string; value: string }>;
  identity?: string;
};

export type PlaygroundContentProps = {
  server: string;
  url: string;
  method: string;
  headers?: Header[];
  queryParams?: QueryParam[];
  pathParams?: PathParam[];
  defaultBody?: string;
};

export const Playground = ({
  server,
  url,
  method,
  headers = [],
  queryParams = [],
  pathParams = [],
  defaultBody = "",
}: PlaygroundContentProps) => {
  const { register, control, handleSubmit, watch, setValue, ...form } =
    useForm<PlaygroundForm>({
      defaultValues: {
        body: defaultBody,
        queryParams: queryParams.map((param) => ({
          name: param.name,
          value: param.defaultValue ?? "",
          active: param.defaultActive ?? false,
        })),
        pathParams: pathParams.map((param) => ({
          name: param.name,
          value: param.defaultValue ?? "",
        })),
        headers: headers.map((header) => ({
          name: header.name,
          value: header.defaultValue ?? "",
        })),
        identity: NO_IDENTITY,
      },
    });
  const formState = watch();
  const identities = useApiIdentities();

  const setOnce = useRef(false);
  useEffect(() => {
    if (setOnce.current) return;
    const firstIdentity = identities.data?.at(0);
    if (firstIdentity) {
      setValue("identity", firstIdentity.id);
      setOnce.current = true;
    }
  }, [setValue, identities.data]);

  const queryMutation = useMutation({
    mutationFn: async (data: PlaygroundForm) => {
      const requestUrl = createUrl(server, url, data);
      const start = performance.now();

      const request = new Request(requestUrl, {
        method: method.toUpperCase(),
        headers: Object.fromEntries(
          data.headers
            .filter((h) => h.name)
            .map((header) => [header.name, header.value]),
        ),
      });

      if (data.identity !== NO_IDENTITY) {
        identities.data
          ?.find((i) => i.id === data.identity)
          ?.authorizeRequest(request);
      }
      const response = await fetchTimeout(request);
      const time = performance.now() - start;

      const body = await response.text();

      return {
        status: response.status,
        headers: response.headers,
        size: body.length,
        body,
        time,
      };
    },
  });

  const path = url.split("/").map((part, i, arr) => {
    const isPathParam = part.startsWith("{") && part.endsWith("}");
    const replaced = part.replace(/[{}]/g, "");
    const value = formState.pathParams.find((p) => p.name === replaced)?.value;

    const pathParamValue = value ? (
      <ColorizedParam backgroundOpacity="25%" name={part} slug={part}>
        {encodeURIComponent(value)}
      </ColorizedParam>
    ) : (
      <span
        className="underline decoration-wavy decoration-red-500"
        title={`Missing value for path parameter \`${replaced}\``}
      >
        {part}
      </span>
    );

    return (
      // eslint-disable-next-line react/no-array-index-key
      <Fragment key={part + i}>
        {isPathParam ? pathParamValue : part}
        {i < arr.length - 1 && "/"}
        <wbr />
      </Fragment>
    );
  });

  const lang = mimeTypeToLanguage(
    queryMutation.data?.headers.get("Content-Type") ?? "",
  );

  const headerEntries = Array.from(queryMutation.data?.headers.entries() ?? []);

  const urlQueryParams = formState.queryParams
    .filter((p) => p.active)
    .map((p, i, arr) => (
      <Fragment key={p.name}>
        {p.name}={encodeURIComponent(p.value).replaceAll("%20", "+")}
        {i < arr.length - 1 && "&"}
        <wbr />
      </Fragment>
    ));

  return (
    <FormProvider
      {...{ register, control, handleSubmit, watch, setValue, ...form }}
    >
      <form onSubmit={handleSubmit((data) => queryMutation.mutateAsync(data))}>
        <div className="grid grid-cols-2 text-sm h-full">
          <div className="flex flex-col gap-4 p-8 bg-muted/50 after:bg-muted-foreground/20 relative after:absolute after:w-px after:inset-0 after:left-auto">
            <div className="flex gap-2 items-stretch">
              <div className="flex flex-1 items-center w-full border rounded-md">
                <div className="border-r p-2 bg-muted rounded-l-md self-stretch font-semibold font-mono">
                  {method.toUpperCase()}
                </div>
                <div className="p-2 font-mono text-xs">
                  {path}
                  {urlQueryParams.length > 0 ? "?" : ""}
                  {urlQueryParams}
                </div>
              </div>
              <Button type="submit" className="h-auto flex gap-1">
                Send
              </Button>
            </div>
            <Tabs
              defaultValue={pathParams.length > 0 ? "parameters" : "headers"}
            >
              <div className="flex justify-between">
                <TabsList>
                  {queryParams.length + pathParams.length > 0 && (
                    <TabsTrigger value="parameters">Parameters</TabsTrigger>
                  )}
                  <TabsTrigger value="headers">
                    Headers{" "}
                    {formState.headers.length > 0 &&
                      `(${formState.headers.length})`}
                  </TabsTrigger>
                  <TabsTrigger
                    value="body"
                    disabled={
                      !["POST", "PUT", "PATCH", "DELETE"].includes(
                        method.toUpperCase(),
                      )
                    }
                  >
                    Body
                  </TabsTrigger>
                </TabsList>
                <div className="flex gap-2 items-center">
                  Auth:
                  <Select
                    onValueChange={(value) => setValue("identity", value)}
                    value={formState.identity}
                    defaultValue={formState.identity}
                  >
                    <SelectTrigger className="w-[180px] flex">
                      {identities.isPending ? <Spinner /> : <SelectValue />}
                    </SelectTrigger>
                    <SelectContent align="center">
                      <SelectItem value={NO_IDENTITY}>None</SelectItem>
                      {identities.data?.map((identity) => (
                        <SelectItem key={identity.id} value={identity.id}>
                          {identity.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <TabsContent value="headers">
                <Headers control={control} register={register} />
              </TabsContent>
              <TabsContent value="parameters">
                {pathParams.length > 0 && (
                  <div className="flex flex-col gap-4 my-4">
                    <span className="font-semibold">Path Parameters</span>
                    <PathParams control={control} />
                  </div>
                )}
                {queryParams.length > 0 && (
                  <div className="flex flex-col gap-4 my-4">
                    <span className="font-semibold">Query Parameters</span>
                    <QueryParams control={control} queryParams={queryParams} />
                  </div>
                )}
              </TabsContent>
              <TabsContent value="body">
                <textarea
                  {...register("body")}
                  className="border w-full rounded p-2 bg-muted h-40"
                />
              </TabsContent>
            </Tabs>
          </div>
          <div className="flex flex-col gap-4 p-8 bg-muted/70">
            {queryMutation.error ? (
              <div>
                Error:{" "}
                {queryMutation.error.message ||
                  String(queryMutation.error) ||
                  "Unexpected error"}
              </div>
            ) : queryMutation.data ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <div className="flex text-xs gap-6">
                    <div>
                      Status: {queryMutation.data.status}{" "}
                      {statusCodeMap[queryMutation.data.status] ?? ""}
                    </div>
                    <div>Time: {queryMutation.data.time.toFixed(0)}ms</div>
                    <div>Size: {queryMutation.data.size} B</div>
                  </div>
                </div>
                {/*<UrlDisplay host={host} path={url} />*/}
                <Tabs defaultValue="response">
                  <TabsList>
                    <TabsTrigger value="response">Response</TabsTrigger>
                    <TabsTrigger value="headers">
                      {headerEntries.length
                        ? `Headers (${headerEntries.length})`
                        : "No headers"}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="response">
                    <ResponseTab
                      headers={queryMutation.data.headers}
                      body={queryMutation.data.body}
                    />
                  </TabsContent>
                  <TabsContent value="headers">
                    <Card className="grid grid-cols-2 w-full gap-2.5 font-mono text-xs shadow-none p-4">
                      <div className="font-semibold">Key</div>
                      <div className="font-semibold">Value</div>
                      {headerEntries.map(([key, value]) => (
                        <Fragment key={key}>
                          <div>{key}</div>
                          <div className="break-words">{value}</div>
                        </Fragment>
                      ))}
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="grid place-items-center h-full">
                <span className="text-[16px] font-semibold text-muted-foreground">
                  {queryMutation.isPending ? (
                    <Spinner />
                  ) : (
                    "Send a request first to see the response here"
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </form>
    </FormProvider>
  );
};

export default Playground;