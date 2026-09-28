import { ScrollView } from 'react-native';
import { HeartRatePanel } from '../components/HeartRatePanel';
import { NavBack } from '../components/kit/Grouped';
import { Screen } from '../components/Screen';

export default function HeartRoute() {
  return (
    <Screen>
      <NavBack label="Back" title="Heart rate" testID="heart-back" />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <HeartRatePanel />
      </ScrollView>
    </Screen>
  );
}
