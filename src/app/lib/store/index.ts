import { configureStore } from "@reduxjs/toolkit";
import { openApiSlice } from "./openApi";

export const makeStore = () => {
  return configureStore({
    reducer: {
      openApi: openApiSlice.reducer,
    },
  });
};

// Infer the type of makeStore
export type AppStore = ReturnType<typeof makeStore>;
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
