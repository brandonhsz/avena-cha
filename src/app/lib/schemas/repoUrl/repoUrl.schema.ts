import z from "zod";

export const GitHubUrlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      try {
        const urlObj = new URL(url);
        return (
          urlObj.hostname === "github.com" &&
          urlObj.pathname.split("/").filter(Boolean).length >= 2
        );
      } catch {
        return false;
      }
    },
    {
      message:
        "it would be a valid GitHub URL (e.g.: https://github.com/usuario/repositorio)",
    }
  );
