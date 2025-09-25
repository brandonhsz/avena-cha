import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";
import { createWriteStream } from "fs";
import { mkdirSync, existsSync, readdirSync, statSync, readFileSync } from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import AdmZip from "adm-zip";
import path from "path";

const streamPipeline = promisify(pipeline);

export const maxDuration = 30;

// GitHub URL validation schema
const GitHubUrlSchema = z
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
        "Debe ser una URL válida de GitHub (ej: https://github.com/usuario/repositorio)",
    }
  );

// Function to get repository information from GitHub API
async function getRepositoryInfo(githubUrl: string) {
  try {
    const url = new URL(githubUrl);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const owner = pathParts[0];
    const repo = pathParts[1];

    // Get basic repository information
    const repoResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "GitHub-Repo-Analyzer",
        },
      }
    );

    if (!repoResponse.ok) {
      throw new Error(
        `Error al obtener información del repositorio: ${repoResponse.status}`
      );
    }

    const repoData = await repoResponse.json();

    // Get README content if it exists
    let readmeContent = "";
    try {
      const readmeResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/readme`,
        {
          headers: {
            Accept: "application/vnd.github.v3.raw",
            "User-Agent": "GitHub-Repo-Analyzer",
          },
        }
      );

      if (readmeResponse.ok) {
        readmeContent = await readmeResponse.text();
        // Limit README content to avoid token excess
        readmeContent = readmeContent.substring(0, 2000);
      }
    } catch (error) {
      console.log("No se pudo obtener el README:", error);
    }

    // Get repository languages
    const languagesResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/languages`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "GitHub-Repo-Analyzer",
        },
      }
    );

    let languages = {};
    if (languagesResponse.ok) {
      languages = await languagesResponse.json();
    }

    return {
      name: repoData.name,
      fullName: repoData.full_name,
      description: repoData.description,
      language: repoData.language,
      languages,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      openIssues: repoData.open_issues_count,
      size: repoData.size,
      createdAt: repoData.created_at,
      updatedAt: repoData.updated_at,
      defaultBranch: repoData.default_branch,
      topics: repoData.topics || [],
      readme: readmeContent,
      htmlUrl: repoData.html_url,
      license: repoData.license?.name || "Sin licencia especificada",
    };
  } catch (error) {
    throw new Error(
      `Error al analizar el repositorio: ${
        error instanceof Error ? error.message : "Error desconocido"
      }`
    );
  }
}

function getRepoStructureAndContent(dir: string, base = ""): string {
  let result = "";
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const relPath = path.join(base, item);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      result += `\n📁 ${relPath}/\n`;
      result += getRepoStructureAndContent(fullPath, relPath);
    } else {
      result += `\n📄 ${relPath}\n`;
      try {
        const content = readFileSync(fullPath, "utf8").substring(0, 2000);
        result += `\`\`\`\n${content}\n\`\`\`\n`;
      } catch {
        result += "(No se pudo leer el archivo)\n";
      }
    }
  }
  return result;
}

export async function POST(req: Request) {
  try {
    const { url }: { url: string } = await req.json();
    console.log("URL del repositorio recibida:", url);

    const validationResult = GitHubUrlSchema.safeParse(url);
    if (!validationResult.success) {
      return Response.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    // Descargar el ZIP del repositorio y descomprimirlo
    const repoUrl = new URL(validationResult.data);
    const repoInfo = await getRepositoryInfo(validationResult.data);

    const [owner, repo] = repoUrl.pathname.split("/").filter(Boolean);

    // Crear carpeta si no existe
    if (!existsSync("repositorio")) {
      mkdirSync("repositorio");
    }

    const branch = repoInfo.defaultBranch || "main";
    const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
    const zipPath = "repositorio/repo.zip";

    // Descargar el ZIP
    const response = await fetch(zipUrl);
    if (!response.ok) {
      throw new Error("No se pudo descargar el ZIP del repositorio.");
    }
    const fileStream = createWriteStream(zipPath);
    await streamPipeline(response.body, fileStream);

    // Descomprimir el ZIP usando adm-zip
    const zip = new AdmZip(zipPath);
    zip.extractAllTo("repositorio", true);

    console.log("Repositorio descargado y descomprimido en 'repositorio'");

    // Obtener estructura y contenido del repositorio
    const repoText = getRepoStructureAndContent("repositorio");

    // Get repository information

    // Create prompt to generate summary
    const prompt = `Analiza el siguiente repositorio de GitHub y proporciona un resumen completo y profesional:
    si este repo no tiene README o el README esta vacio, di no hay readme disponible y empieza a analizar el codigo del repositorio y sus archivos, tambien imprime la estructura de carpetas y archivos del repositorio dale formato con markdown a la estructura de carpetas. y agrega un (una descripcion de esa carpeta y lo que contiene), esta estructura colocala hasta el final del analisi, tambien al final del analisis necesito que me coloques el codigo que esta dentro de src/main/resources/application.yml.
**Información del repositorio:**
- Nombre: ${repoInfo.name}
- Descripción: ${repoInfo.description || "Sin descripción"}
- Lenguaje principal: ${repoInfo.language || "No especificado"}
- Lenguajes utilizados: ${
      Object.keys(repoInfo.languages).join(", ") || "No disponible"
    }
- Estrellas: ${repoInfo.stars}
- Forks: ${repoInfo.forks}
- Issues abiertos: ${repoInfo.openIssues}
- Temas/Topics: ${repoInfo.topics.join(", ") || "Sin temas"}
- Licencia: ${repoInfo.license}
- Creado: ${new Date(repoInfo.createdAt).toLocaleDateString()}
- Última actualización: ${new Date(repoInfo.updatedAt).toLocaleDateString()}

**README (primeros 2000 caracteres):**
${repoInfo.readme || "No hay README disponible"}

**Estructura y contenido del repositorio:**  
${repoText}

Por favor, proporciona un análisis detallado que incluya:
1. **Resumen general**: Qué hace este proyecto y cuál es su propósito
2. **Tecnologías utilizadas**: Stack tecnológico principal
3. **Popularidad y actividad**: Análisis de estrellas, forks y actividad reciente
4. **Estructura y organización**: Cómo está organizado el proyecto
5. **Casos de uso**: Para qué se podría utilizar este repositorio
6. **Calidad del proyecto**: Evaluación basada en documentación, estructura y métricas

Sé conciso pero informativo, y enfócate en los aspectos más relevantes para un desarrollador que esté evaluando este repositorio.`;

    const result = streamText({
      model: openai("gpt-4o"),
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Error en la API:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}
