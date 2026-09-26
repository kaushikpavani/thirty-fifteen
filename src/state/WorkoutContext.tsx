import { useWorkoutEngine } from '../hooks/useWorkoutEngine';
import { useSettings } from './SettingsContext';
import React, { createContext, useContext } from 'react';

type Engine = ReturnType<typeof useWorkoutEngine>;

const WorkoutContext = createContext<Engine | null>(null);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const engine = useWorkoutEngine(settings);
  return <WorkoutContext.Provider value={engine}>{children}</WorkoutContext.Provider>;
}

export function useWorkout(): Engine {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkout must be used inside WorkoutProvider');
  return ctx;
}
