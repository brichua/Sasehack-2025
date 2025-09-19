import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import CreateAccount from "./CreateAccount";
import Questboard from "./Questboard";

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="CreateAccount" component={CreateAccount} />
        <Stack.Screen name="Questboard" component={Questboard} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
