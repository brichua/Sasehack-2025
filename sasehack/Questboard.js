import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Modal, ScrollView, TextInput, Alert } from "react-native";
import { collection, getDocs, addDoc, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db, auth } from "./firebase";
import * as ImagePicker from "expo-image-picker";
import { FontAwesome } from "@expo/vector-icons";

export default function Questboard() {
  const [quests, setQuests] = useState([]);
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPostDesc, setNewPostDesc] = useState("");
  const [newPostImage, setNewPostImage] = useState(null);
  const [creatingQuest, setCreatingQuest] = useState(false);

<<<<<<< Updated upstream
  useEffect(() => {
    const fetchUser = async () => {
      const userDoc = await getDoc(doc(db, "Users", userId));
      if (userDoc.exists()) {
        setDisplayName(userDoc.data().displayName);
      } else {
        setDisplayName("Unknown User");
      }
    };
=======
  const CLASSES = [
    { name: "Explorer", icon: "map" },
    { name: "Baker", icon: "cutlery" },
    { name: "Artist", icon: "paint-brush" },
  ];
>>>>>>> Stashed changes

  const BADGES = [
    { name: "Bakery Novice", class: "Baker" },
    { name: "Bakery Expert", class: "Baker" },
    { name: "City Explorer", class: "Explorer" },
    { name: "Museum Visitor", class: "Explorer" },
    { name: "Sketcher", class: "Artist" },
  ];

  const [newQuest, setNewQuest] = useState({
    title: "",
    description: "",
    location: "",
    class: "",
    difficulty: 0,
    badge: "",
  });
  const [filteredBadges, setFilteredBadges] = useState([]);

  const fetchQuests = async () => {
    const questSnap = await getDocs(collection(db, "Quests"));
    const questList = questSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setQuests(questList);
  };

  useEffect(() => { fetchQuests(); }, []);

  const pickImage = async (setter) => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing:true, aspect:[1,1], quality:0.5 });
    if(!result.canceled) setter(result.assets[0].uri);
  };

  const handleCompleteQuest = async (quest) => {
    try {
      const user = auth.currentUser;
      const questRef = doc(db, "Quests", quest.id);

<<<<<<< Updated upstream
      // Update user's XP and badges
      const userRef = doc(db, "Users", userId);
      await updateDoc(userRef, {
        xp: (quest.xpReward || 0) + (user.xp || 0),
        badges: quest.badgeReward ? arrayUnion(quest.badgeReward) : [],
      });
=======
      if(newPostDesc) {
        let imageUrl = null;
        if(newPostImage) {
          // (MVP) Image uploading logic goes here
        }
        await updateDoc(questRef, { posts: arrayUnion({ username:user.displayName, userIcon:"", description:newPostDesc, image:imageUrl }) });
        setNewPostDesc(""); setNewPostImage(null);
      }
>>>>>>> Stashed changes

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { xp: arrayUnion(quest.rewards.xp) });
      if(quest.rewards.badge) {
        await updateDoc(userRef, { [`badges.${quest.rewards.badge}`]: arrayUnion(1) });
      }

      Alert.alert("Quest Completed!");
      setModalVisible(false);
      fetchQuests();
    } catch(e){ Alert.alert("Error", e.message); }
  };

  const handleCreateQuest = async () => {
    try {
      const user = auth.currentUser;
      await addDoc(collection(db,"Quests"),{
        ...newQuest,
        rewards: { xp: newQuest.difficulty*10, badge: newQuest.badge },
        user: { name:user.displayName, icon:"" },
        posts: []
      });
      setCreatingQuest(false);
      fetchQuests();
    } catch(e){ Alert.alert("Error", e.message); }
  };

  const renderQuestCard = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => { setSelectedQuest(item); setModalVisible(true); }}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={{color:"#555"}}>{item.description.slice(0,50)}...</Text>
      <Text>Class: {item.class} | XP: {item.rewards.xp}</Text>
      <Text>By: {item.user.name} {item.rewards.badge ? "| Badge: " + item.rewards.badge : ""}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{flex:1, padding:10, backgroundColor:"#f7f1e3"}}>
      <TouchableOpacity style={styles.createButton} onPress={()=>setCreatingQuest(true)}>
        <Text style={styles.buttonText}>Create New Quest</Text>
      </TouchableOpacity>

      <FlatList
        data={quests}
        keyExtractor={(item)=>item.id}
        renderItem={renderQuestCard}
      />

      {/* Quest Modal */}
      <Modal visible={modalVisible} animationType="slide">
        <ScrollView style={{padding:10}}>
          {selectedQuest && <>
            <Text style={{fontSize:24,fontWeight:"bold"}}>{selectedQuest.title}</Text>
            <Text>{selectedQuest.description}</Text>
            <Text>Class: {selectedQuest.class}</Text>
            <Text>Difficulty: {selectedQuest.difficulty}</Text>
            <Text>Location: {selectedQuest.location}</Text>
            <Text>By: {selectedQuest.user.name}</Text>
            <Text>XP: {selectedQuest.rewards.xp} | Badge: {selectedQuest.rewards.badge || "None"}</Text>

            <Text style={{marginTop:20,fontSize:18,fontWeight:"bold"}}>Posts</Text>
            {selectedQuest.posts?.map((p,i)=>(
              <View key={i} style={{padding:5,marginVertical:5,backgroundColor:"#fff",borderRadius:8}}>
                <Text>{p.username}</Text>
                <Text>{p.description}</Text>
                {p.image && <Image source={{uri:p.image}} style={{width:"100%",height:150}} />}
              </View>
            ))}

            <TextInput placeholder="Add a post (max 50 words)" style={styles.input} value={newPostDesc} onChangeText={setNewPostDesc} multiline />
            <TouchableOpacity style={styles.button} onPress={()=>pickImage(setNewPostImage)}>
              <Text style={styles.buttonText}>Pick Image (Optional)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button,{backgroundColor:"#00b894"}]} onPress={()=>handleCompleteQuest(selectedQuest)}>
              <Text style={styles.buttonText}>Complete Quest</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button,{backgroundColor:"#d63031"}]} onPress={()=>setModalVisible(false)}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </>}
        </ScrollView>
      </Modal>

      {/* Create Quest Modal */}
      <Modal visible={creatingQuest} animationType="slide">
        <ScrollView style={{padding:10}}>
          <TextInput
            placeholder="Title"
            style={styles.input}
            value={newQuest.title}
            onChangeText={(text)=>setNewQuest({...newQuest,title:text})}
          />
          <TextInput
            placeholder="Description"
            style={[styles.input,{height:100}]}
            value={newQuest.description}
            onChangeText={(text)=>setNewQuest({...newQuest,description:text})}
            multiline
          />
          <TextInput
            placeholder="Location (Optional)"
            style={styles.input}
            value={newQuest.location}
            onChangeText={(text)=>setNewQuest({...newQuest,location:text})}
          />

          {/* Class Picker */}
          <Text style={{marginTop:10, fontWeight:"bold"}}>Select Class:</Text>
          <View style={{flexDirection:"row", marginVertical:5}}>
            {CLASSES.map((c) => (
              <TouchableOpacity
                key={c.name}
                style={{
                  padding:10,
                  marginRight:10,
                  borderWidth: newQuest.class === c.name ? 2 : 1,
                  borderColor: newQuest.class === c.name ? "#6c5ce7" : "#ccc",
                  borderRadius:8,
                  alignItems:"center"
                }}
                onPress={() => {
                  setNewQuest({...newQuest,class:c.name});
                  setFilteredBadges(BADGES.filter(b => b.class === c.name));
                  setNewQuest(prev => ({...prev, badge:""}));
                }}
              >
                <FontAwesome name={c.icon} size={24} color="#333" />
                <Text>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Difficulty Stars */}
          <Text style={{fontWeight:"bold"}}>Select Difficulty:</Text>
          <View style={{flexDirection:"row", marginVertical:5}}>
            {[1,2,3].map((star)=>(
              <TouchableOpacity key={star} onPress={()=>setNewQuest({...newQuest,difficulty:star})}>
                <FontAwesome
                  name={star <= newQuest.difficulty ? "star" : "star-o"}
                  size={32}
                  color="#f1c40f"
                  style={{marginRight:5}}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text>XP Reward: {newQuest.difficulty*10}</Text>

          {/* Badge Picker */}
          {filteredBadges.length > 0 && (
            <>
              <Text style={{fontWeight:"bold", marginTop:10}}>Select Badge Reward:</Text>
              <View style={{flexDirection:"row", flexWrap:"wrap"}}>
                {filteredBadges.map(b => (
                  <TouchableOpacity
                    key={b.name}
                    style={{
                      padding:8,
                      borderWidth: newQuest.badge === b.name ? 2 : 1,
                      borderColor: newQuest.badge === b.name ? "#6c5ce7" : "#ccc",
                      borderRadius:8,
                      margin:5
                    }}
                    onPress={()=>setNewQuest({...newQuest,badge:b.name})}
                  >
                    <Text>{b.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity style={[styles.button,{backgroundColor:"#6c5ce7"}]} onPress={handleCreateQuest}>
            <Text style={styles.buttonText}>Create Quest</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button,{backgroundColor:"#d63031"}]} onPress={()=>setCreatingQuest(false)}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor:"#fff", padding:15, borderRadius:10, marginBottom:10 },
  title: { fontSize:18, fontWeight:"bold" },
  button: { padding:10, borderRadius:8, backgroundColor:"#6c5ce7", marginVertical:5 },
  buttonText: { color:"#fff", textAlign:"center", fontWeight:"bold" },
  createButton: { padding:15, borderRadius:10, backgroundColor:"#00b894", marginBottom:10 },
  input: { backgroundColor:"#fff", padding:10, borderRadius:8, marginVertical:5 }
});
