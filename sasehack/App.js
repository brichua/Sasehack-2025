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
import { View, TouchableOpacity, Text, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FontAwesome } from '@expo/vector-icons';
import styles, { colors } from './styles';

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
      <View style={styles.safeArea}>
        <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
          <Text style={{fontSize:20, fontWeight:'700', color: colors.textDark, textAlign:'center', marginBottom:12}}>Are you sure you want to log out?</Text>
          <Text style={{color: colors.textMuted, marginBottom:18, textAlign:'center'}}>You will need to sign in again to access your profile and quests.</Text>

          <View style={{flexDirection:'row'}}>
            <TouchableOpacity onPress={handleLogout} style={[styles.button,{backgroundColor: colors.viridian, marginRight:8}]}>
              <Text style={styles.buttonText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Questboard')} style={[styles.button,{backgroundColor: colors.viridian}]}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.viridian,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.mintCream },
        tabBarIcon: ({ focused, color, size }) => {
          let name = 'circle';
          if (route.name === 'Questboard') name = 'list';
          else if (route.name === 'Map') name = 'map';
          else if (route.name === 'Guild') name = 'users';
          else if (route.name === 'Profile') name = 'user';
          else if (route.name === 'Logout') name = 'sign-out';
          return <FontAwesome name={name} size={20} color={focused ? colors.viridian : colors.textMuted} />;
        }
      })}
    >
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
