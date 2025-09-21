import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { FontAwesome } from '@expo/vector-icons';
import styles, { colors } from './styles';

export default function Landing({ navigation }) {
  return (
    <View style={styles.safeArea}>
      <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
        <View style={{alignItems:'center', marginBottom:24}}>
          <View style={{width:96, height:96, borderRadius:24, backgroundColor: colors.viridian, alignItems:'center', justifyContent:'center', marginBottom:12}}>
            <FontAwesome name="star" size={40} color="#fff" />
          </View>
          <Text style={{fontSize:24, fontWeight:'800', color: colors.textDark}}>Questboard RPG</Text>
          <Text style={{color: colors.textMuted, marginTop:6}}>Discover quests, join guilds, earn badges</Text>
        </View>

        <TouchableOpacity style={[styles.button, {backgroundColor: colors.viridian, width: '80%'}]} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, {backgroundColor: colors.cambridgeBlue, width: '80%'}]} onPress={() => navigation.navigate("Signup")}>
          <Text style={styles.buttonText}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
