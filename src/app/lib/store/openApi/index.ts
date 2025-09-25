import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export interface openApiResponse {
  message: string;
}

const initialState: openApiResponse = {
  message: "",
};

export const openApiSlice = createSlice({
  name: "openApiResponse",
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<string>) => {
      state.message += action.payload;
    },
    resetMessage: (state) => {
      state.message = "";
    },
    initializeMessageApi: (state, action: PayloadAction<string>) => {
      state.message = action.payload;
    },
  },
});

// Action creators are generated for each case reducer function
export const { addMessage, resetMessage, initializeMessageApi } =
  openApiSlice.actions;

export default openApiSlice.reducer;
