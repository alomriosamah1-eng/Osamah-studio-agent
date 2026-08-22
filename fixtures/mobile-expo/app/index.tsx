import { View, Text } from "react-native";
import { PreviewStatus } from "../components/PreviewStatus";

export default function Home() {
  return (
    <View>
      <Text>Build with clarity.</Text>
      <Text>Edit, refresh, inspect, and validate.</Text>
      <PreviewStatus />
    </View>
  );
}
