import { copy } from "../helpers/copy";
import { install } from "../helpers/install";

import { Sema } from "async-sema";
import { async as glob } from "fast-glob";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { bold, cyan } from "picocolors";
import pkg from "../package.json";

import { GetTemplateFileArgs, InstallTemplateArgs } from "./types";

/**
 * Get the file path for a given file in a template, e.g. "next.config.js".
 */
export const getTemplateFile = ({
  template,
  mode,
  file,
}: GetTemplateFileArgs): string => {
  return path.join(__dirname, template, mode, file);
};

export const SRC_DIR_NAMES = ["app", "pages", "styles"];

/**
 * Install a Next.js internal template to a given `root` directory.
 */
export const installTemplate = async ({
  appName,
  root,
  packageManager,
  isOnline,
  template,
  mode,
  eslint,
  importAlias,
  skipInstall,
}: InstallTemplateArgs) => {
  console.log(bold(`Using ${packageManager}.`));

  /**
   * Copy the template files to the target directory.
   */
  console.log("\nInitializing project with template:", template, "\n");
  const templatePath = path.join(__dirname, template, mode);
  const copySource = ["**"];
  if (!eslint) copySource.push("!eslintrc.json");

  await copy(copySource, root, {
    parents: true,
    cwd: templatePath,
    rename(name) {
      switch (name) {
        case "gitignore":
        case "eslintrc.json": {
          return `.${name}`;
        }
        // README.md is ignored by webpack-asset-relocator-loader used by ncc:
        // https://github.com/vercel/webpack-asset-relocator-loader/blob/e9308683d47ff507253e37c9bcbb99474603192b/src/asset-relocator.js#L227
        case "README-template.md": {
          return "README.md";
        }
        default: {
          return name;
        }
      }
    },
  });

  const tsconfigFile = path.join(
    root,
    mode === "js" ? "jsconfig.json" : "tsconfig.json",
  );
  await fs.writeFile(
    tsconfigFile,
    (await fs.readFile(tsconfigFile, "utf8")).replace(
      `"@/*":`,
      `"${importAlias}":`,
    ),
  );

  // update import alias in any files if not using the default
  if (importAlias !== "@/*") {
    const files = await glob("**/*", {
      cwd: root,
      dot: true,
      stats: false,
      // We don't want to modify compiler options in [ts/js]config.json
      // and none of the files in the .git folder
      ignore: ["tsconfig.json", "jsconfig.json", ".git/**/*"],
    });
    const writeSema = new Sema(8, { capacity: files.length });
    await Promise.all(
      files.map(async (file) => {
        await writeSema.acquire();
        const filePath = path.join(root, file);
        if ((await fs.stat(filePath)).isFile()) {
          await fs.writeFile(
            filePath,
            (await fs.readFile(filePath, "utf8")).replace(
              `@/`,
              `${importAlias.replace(/\*/g, "")}`,
            ),
          );
        }
        writeSema.release();
      }),
    );
  }

  /** Copy the version from package.json or override for tests. */
  const version = process.env.ZUDOKU_PRIVATE_TEST_VERSION ?? pkg.version;

  /** Create a package.json for the new project and write it to disk. */
  const packageJson: any = {
    name: appName,
    version: "0.1.0",
    private: true,
    scripts: {
      dev: `zudoku dev`,
      build: "zudoku build",
      lint: "eslint",
    },
    /**
     * Default dependencies.
     */
    dependencies: {
      react: ">18.0.0",
      "react-dom": ">18.0.0",
      zudoku: version,
    },
    devDependencies: {},
  };

  /**
   * TypeScript projects will have type definitions and other devDependencies.
   */
  if (mode === "ts") {
    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      typescript: "^5",
      "@types/node": "^20",
      "@types/react": "^18",
      "@types/react-dom": "^18",
    };
  }

  /* Default ESLint dependencies. */
  if (eslint) {
    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      eslint: "^8",
    };
  }

  const devDeps = Object.keys(packageJson.devDependencies).length;
  if (!devDeps) delete packageJson.devDependencies;

  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify(packageJson, null, 2) + os.EOL,
  );

  if (skipInstall) return;

  console.log("\nInstalling dependencies:");
  for (const dependency in packageJson.dependencies)
    console.log(`- ${cyan(dependency)}`);

  if (devDeps) {
    console.log("\nInstalling devDependencies:");
    for (const dependency in packageJson.devDependencies)
      console.log(`- ${cyan(dependency)}`);
  }

  console.log();

  await install(packageManager, isOnline);
};

export * from "./types";