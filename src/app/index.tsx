import { HomeScreen } from '../screens/HomeScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { useSettings } from '../state/SettingsContext';

export default function IndexRoute() {
  const { welcomeSeen, markWelcomeSeen } = useSettings();
  if (!welcomeSeen) {
    return <WelcomeScreen onDone={() => void markWelcomeSeen()} />;
  }
  return <HomeScreen />;
}
