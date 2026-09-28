import { ScrollView } from 'react-native';
import { PowerMeterPanel } from '../components/PowerMeterPanel';
import { NavBack } from '../components/kit/Grouped';
import { Screen } from '../components/Screen';

export default function PowerRoute() {
  return (
    <Screen>
      <NavBack label="Back" title="Power meter" testID="power-back" />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <PowerMeterPanel variant="settings" />
      </ScrollView>
    </Screen>
  );
}
