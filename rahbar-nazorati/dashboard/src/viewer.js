import { createContext, useContext } from 'react';

export const ViewerContext = createContext({ isDirector: true, name: '', role: 'DIRECTOR' });

export function useViewer() {
  return useContext(ViewerContext);
}
