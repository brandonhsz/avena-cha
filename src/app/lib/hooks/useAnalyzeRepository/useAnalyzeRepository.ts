import { useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { GitHubUrlSchema } from "../../schemas";
import { addMessage, resetMessage } from "../../store/openApi";

// Define your action types
const ANALYZE_REPOSITORY_REQUEST = "ANALYZE_REPOSITORY_REQUEST";
const ANALYZE_REPOSITORY_SUCCESS = "ANALYZE_REPOSITORY_SUCCESS";
const ANALYZE_REPOSITORY_FAILURE = "ANALYZE_REPOSITORY_FAILURE";

// Example action creator
export const analyzeRepository = (repoUrl: string) => async (dispatch: any) => {
  dispatch({ type: ANALYZE_REPOSITORY_REQUEST });
  dispatch(resetMessage());
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: repoUrl }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Error al analizar el repositorio");
    }

    // Read the entire stream response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("No se pudo leer la respuesta");
    }

    let analysisText = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      console.log("Raw chunk:", chunk);

      // For simple text stream, we can add directly
      analysisText += chunk;
      dispatch(addMessage(chunk));
    }
  } catch (error) {
    dispatch({ type: ANALYZE_REPOSITORY_FAILURE, error });
  }
};

// Custom hook
export function useAnalyzeRepository() {
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const { result, error } = useSelector(
    (state: any) => state.analyzeRepository || {}
  );

  const analyze = useCallback(
    (repoUrl: string) => {
      setLoading(true);
      (dispatch as any)(analyzeRepository(repoUrl)).finally(() => {
        setLoading(false);
      });
    },
    [dispatch]
  );

  return { analyze, loading, result, error };
}
