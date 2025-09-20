import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Landing from "./landing";
import Login from "./login";
import Signup from "./signup";
import Profile from "./profile";
import Guild from "./Guild";
import Questboard from "./Questboard";
import Map from "./Map";
import { auth } from './firebase';
import { View, TouchableOpacity, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const LogoutTab = () => {
    const navigation = useNavigation();
    const handleLogout = async () => {
      try {
        await auth.signOut();
        navigation.navigate('Landing');
      } catch (e) { console.warn('Sign out error', e); }
    };
    return (
      <View style={{flex:1,justifyContent:'center',alignItems:'center'}}>
        <TouchableOpacity onPress={handleLogout} style={{padding:12,backgroundColor:'#d63031',borderRadius:8}}>
          <Text style={{color:'#fff',fontWeight:'700'}}>Logout</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Questboard" component={Questboard} />
      <Tab.Screen name="Map" component={Map} />
      <Tab.Screen name="Guild" component={Guild} />
      <Tab.Screen name="Profile" component={Profile} />
      <Tab.Screen name="Logout" component={LogoutTab} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Landing" component={Landing} />
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="Signup" component={Signup} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
