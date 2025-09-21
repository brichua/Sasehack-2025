import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Image, FlatList, Alert, ScrollView, Platform } from 'react-native';
import styles, { colors } from './styles';
import { collection, getDocs, addDoc, doc, updateDoc, arrayUnion, getDoc, arrayRemove } from 'firebase/firestore';
import { db, auth } from './firebase';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import googleConfig from './googleConfig';

// Small helper to format counts
const plural = (n, s) => `${n} ${s}${n===1? '':'s'}`;

export default function Guilds() {
  const [guilds, setGuilds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedGuild, setSelectedGuild] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newGuild, setNewGuild] = useState({ name:'', description:'', icon:'', class:'Explorer', location:'' });
  const [newGuildIcon, setNewGuildIcon] = useState(null);
  const [quests, setQuests] = useState([]);

  const CLASSES = [ { name: 'Explorer', icon: 'map' }, { name: 'Baker', icon: 'cutlery' }, { name: 'Artist', icon: 'paint-brush' } ];
  const BADGES = [
    { name: 'Bakery Novice', class: 'Baker' },
    { name: 'Bakery Expert', class: 'Baker' },
    { name: 'City Explorer', class: 'Explorer' },
    { name: 'Museum Visitor', class: 'Explorer' },
    { name: 'Sketcher', class: 'Artist' },
  ];

  // UI state: view mode and filters
  const [viewMode, setViewMode] = useState('discover'); // 'discover' or 'my'
  const [selectedClasses, setSelectedClasses] = useState([]); // multi-select
  const [classFilterModal, setClassFilterModal] = useState(false);
  const [filteredBadges, setFilteredBadges] = useState([]);
  const [placeQuery, setPlaceQuery] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null); // {name, coords}

  // track current user's guild ids for quick checks
  const [currentUserGuilds, setCurrentUserGuilds] = useState([]);

  // fetch user's guilds list
  const fetchUserGuilds = async () => {
    try {
      const user = auth.currentUser;
      if (!user) { setCurrentUserGuilds([]); return; }
      const udoc = await getDoc(doc(db, 'Users', user.uid));
      if (udoc.exists()) {
        const data = udoc.data();
        const g = Array.isArray(data.guilds) ? data.guilds : [];
        setCurrentUserGuilds(g);
      } else setCurrentUserGuilds([]);
    } catch (e) { console.warn('fetchUserGuilds', e); }
  };

  const fetchGuilds = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'Guilds'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setGuilds(list);
    } catch (e) {
      console.warn('fetchGuilds', e);
      Alert.alert('Error', e.message || 'Failed to fetch guilds');
    }
    setLoading(false);
  };

  const fetchQuests = async () => {
    try {
      const snap = await getDocs(collection(db, 'Quests'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setQuests(list);
    } catch(e){ console.warn('fetchQuests', e); }
  };

  useEffect(()=>{ fetchGuilds(); fetchQuests(); }, []);
  useEffect(()=>{ fetchUserGuilds(); }, []);

  const pickImage = async (setter) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing:true, aspect:[1,1], quality:0.6 });
    if (!res.canceled) setter(res.assets[0].uri);
  };

  const handleCreateGuild = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('You must be signed in to create a guild');
      const data = {
        ...newGuild,
        icon: newGuildIcon || newGuild.icon || null,
        members: [user.uid],
        membersCount: 1,
        quests: []
      };
  const ref = await addDoc(collection(db, 'Guilds'), data);
  // add guild id to user's guilds array
  const userRef = doc(db, 'Users', user.uid);
  await updateDoc(userRef, { guilds: arrayUnion(ref.id) });
      setCreating(false);
      setNewGuild({ name:'', description:'', icon:'', class:'Explorer', location:'' });
      setNewGuildIcon(null);
      fetchGuilds();
  fetchUserGuilds();
    } catch(e){ Alert.alert('Error', e.message); }
  };

  const handleJoinGuild = async (g) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('You must be signed in to join');
  const ref = doc(db, 'Guilds', g.id);
  await updateDoc(ref, { members: arrayUnion(user.uid) });
  // add guild id to user's guilds array
  const userRef = doc(db, 'Users', user.uid);
  await updateDoc(userRef, { guilds: arrayUnion(g.id) });
      // optionally update membersCount locally (re-fetch)
      fetchGuilds();
  fetchUserGuilds();
      Alert.alert('Joined', `You joined ${g.name}`);
    } catch(e){ Alert.alert('Error', e.message); }
  };

  const openGuild = (g) => {
    setSelectedGuild(g);
    setModalVisible(true);
  };

  const handleLeaveGuild = async (g) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('You must be signed in');
      Alert.alert('Leave guild', `Are you sure you want to leave ${g.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: async () => {
          const gRef = doc(db, 'Guilds', g.id);
          await updateDoc(gRef, { members: arrayRemove(user.uid) });
          const uRef = doc(db, 'Users', user.uid);
          await updateDoc(uRef, { guilds: arrayRemove(g.id) });
          fetchGuilds();
          fetchUserGuilds();
          // close modal if currently viewing this guild
          if (selectedGuild?.id === g.id) { setModalVisible(false); setSelectedGuild(null); }
          Alert.alert('Left', `You left ${g.name}`);
        }}
      ]);
    } catch(e) { Alert.alert('Error', e.message); }
  };

  // compute quests for a guild: prefer guild.quests array if present else global quests with guildId
  const questsForGuild = (g) => {
    if (!g) return [];
    if (Array.isArray(g.quests) && g.quests.length>0) return g.quests;
    // filter global quests by guildId
    return quests.filter(q => (q.guildId === g.id) || (q.class === g.class && q.guildId === g.id));
  };

  const renderQuestCard = ({ item }) => {
    return (
      <TouchableOpacity style={styles.card} onPress={()=>{ /* could open quest detail */ }}>
        {item.image ? <Image source={{uri:item.image}} style={{width:'100%',height:120,borderRadius:8,marginBottom:8}} /> : null}
        <Text style={styles.title}>{item.title}</Text>
        <Text style={{color:'#555'}}>{item.description?.slice(0,80)}...</Text>
        <Text style={{marginTop:6}}>Class: {item.class} | XP: {item.rewards?.xp || 0}</Text>
      </TouchableOpacity>
    );
  };

  const handleCreateQuestForGuild = async (g, questData) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Sign in to create quests');
      // ensure user is a member of the guild
      const isMember = (g.members && Array.isArray(g.members) && g.members.includes(user.uid)) || currentUserGuilds.includes(g.id);
      if (!isMember) throw new Error('You must be a member of the guild to create quests for it.');
      const data = {
        ...questData,
        class: g.class,
        guildId: g.id,
        user: { name: user.displayName || '', icon: '' },
        posts: [],
        rewards: { xp: (questData.difficulty||1)*10, badge: questData.badge || '' },
        location: questData.location || null
      };
      await addDoc(collection(db, 'Quests'), data);
      fetchQuests();
      Alert.alert('Quest created', 'Quest added to the guild feed');
    } catch(e){ Alert.alert('Error', e.message); }
  };

  // --- Google Places autocomplete helpers for guild location ---
  const fetchPredictions = async (query) => {
    if (!query) { setPredictions([]); return; }
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${googleConfig.GOOGLE_API_KEY}&types=(cities)`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.predictions) setPredictions(data.predictions);
    } catch (e) { console.warn('Places autocomplete error', e); }
  };

  const fetchPlaceDetails = async (placeId) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${googleConfig.GOOGLE_API_KEY}&fields=geometry,name,formatted_address`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.result && data.result.geometry && data.result.geometry.location) {
        return {
          name: data.result.name || data.result.formatted_address || '',
          address: data.result.formatted_address || '',
          coords: { lat: data.result.geometry.location.lat, lng: data.result.geometry.location.lng }
        };
      }
    } catch (e) { console.warn('Place details error', e); }
    return null;
  };

  const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString() : "";

  const [creatingQuest, setCreatingQuest] = useState(false);
  const [guildQuest, setGuildQuest] = useState({ title:'', description:'', difficulty:0, badge:'', image:null, location:'', placeCoords: null, startDate: null, endDate: null });
  const [questDetailModal, setQuestDetailModal] = useState(false);
  const [viewingQuest, setViewingQuest] = useState(null);
  const [newPostDesc, setNewPostDesc] = useState('');
  const [newPostImage, setNewPostImage] = useState(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [dateError, setDateError] = useState('');

  const handleStartDateChange = (event, selectedDate) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setGuildQuest(prev => {
        const updated = { ...prev, startDate: selectedDate.toISOString() };
        if (prev.endDate && new Date(prev.endDate) < selectedDate) {
          updated.endDate = null;
          setDateError('End date was before start date and was cleared.');
        } else setDateError('');
        return updated;
      });
    }
  };

  const handleEndDateChange = (event, selectedDate) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setGuildQuest(prev => ({ ...prev, endDate: selectedDate.toISOString() }));
      setDateError('');
    }
  };

  // Quick small create-quest UI inside guild modal

  const isUserMemberOf = (g) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return false;
    if (g?.members && Array.isArray(g.members) && g.members.includes(uid)) return true;
    if (currentUserGuilds && currentUserGuilds.includes(g.id)) return true;
    return false;
  };

  return (
    <View style={styles.safeArea}>
      <View style={styles.headerRow}>
        <View style={{flexDirection:'row'}}>
          <TouchableOpacity style={[styles.buttonSmall, {marginRight:6, backgroundColor: viewMode==='discover' ? colors.viridian : colors.cambridgeBlue}]} onPress={()=>setViewMode('discover')}><Text style={styles.buttonText}>Discover</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.buttonSmall, {backgroundColor: viewMode==='my' ? colors.viridian : colors.cambridgeBlue}]} onPress={()=>setViewMode('my')}><Text style={styles.buttonText}>My Guilds</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.createButton} onPress={()=>setCreating(true)}>
          <Text style={styles.buttonText}>Create Guild</Text>
        </TouchableOpacity>
      </View>

      {/* Filters: class + location */}
      <View style={styles.filterRow}>
        <View style={{flex:1, marginRight:6}}>
          <Text style={{fontWeight:'700', color: colors.textDark}}>Class</Text>
          <TouchableOpacity style={{padding:10, marginTop:6, borderRadius:10, borderWidth:1, borderColor:colors.cambridgeBlue, backgroundColor: colors.mintCream}} onPress={()=>setClassFilterModal(true)}>
            <Text style={{color: colors.textDark}}>{selectedClasses.length > 0 ? selectedClasses.join(', ') : 'All'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{flex:1}}>
          <Text style={{fontWeight:'700', color: colors.textDark}}>Location</Text>
          <TextInput placeholder='City' value={placeQuery} onChangeText={t=>{ setPlaceQuery(t); fetchPredictions(t); }} onBlur={()=>setPredictions([])} style={styles.input} />
          {predictions.length>0 && (
            <View style={{backgroundColor:colors.mintCream, borderRadius:8, padding:6}}>
              {predictions.map(p => (
                <TouchableOpacity key={p.place_id} style={{padding:6}} onPress={async ()=>{
                  const d = await fetchPlaceDetails(p.place_id);
                  if (d) {
                    setSelectedLocation(d);
                    setPlaceQuery(d.name || d.address || '');
                    setPredictions([]);
                  }
                }}>
                  <Text style={{color: colors.textDark}}>{p.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

  <FlatList data={guilds.filter(g=>{
        // view mode filter
        if (viewMode==='my' && !(currentUserGuilds.includes(g.id) || (g.members && g.members.includes(auth.currentUser?.uid)))) return false;
        // class filter (multi-select)
        if (selectedClasses.length > 0 && !selectedClasses.includes(g.class)) return false;
        // location filter (simple substring match)
        if (selectedLocation && g.location) {
          if (!g.location.toLowerCase().includes((selectedLocation.name||selectedLocation.address||'').toLowerCase().split(',')[0])) return false;
        }
        return true;
      })} keyExtractor={i=>i.id} renderItem={({item})=>(
        <TouchableOpacity style={styles.guildCard} onPress={()=>openGuild(item)}>
          {item.icon ? <Image source={{uri:item.icon}} style={{width:64,height:64,borderRadius:12,marginRight:12}} /> : <View style={{width:64,height:64,borderRadius:12,backgroundColor:colors.cambridgeBlue,marginRight:12,alignItems:'center',justifyContent:'center'}}><Text style={{color:'#fff',fontWeight:'700'}}>G</Text></View>}
          <View style={{flex:1}}>
            <Text style={{fontWeight:'800', color: colors.textDark}}>{item.name}</Text>
            <Text style={{color: colors.textMuted}} numberOfLines={2}>{item.description}</Text>
            <Text style={{marginTop:6, color: colors.textMuted}}>{plural((item.members||[]).length || item.membersCount || 0, 'member')} • Class: {item.class} • {item.location || ''}</Text>
          </View>
          <TouchableOpacity style={[styles.buttonSmall,{minWidth:80, backgroundColor: colors.viridian}]} onPress={()=>handleJoinGuild(item)}>
            <Text style={styles.buttonText}>Join</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      )} />

      {/* Create Guild Modal */}
      <Modal visible={creating} animationType='slide'>
        <ScrollView style={styles.modalScroll}>
          <TextInput placeholder='Guild name' style={styles.input} value={newGuild.name} onChangeText={t=>setNewGuild(prev=>({...prev, name:t}))} />
          <TextInput placeholder='Description' style={[styles.input,{height:100}]} value={newGuild.description} onChangeText={t=>setNewGuild(prev=>({...prev, description:t}))} multiline />
          <TextInput placeholder='Location (city)' style={styles.input} value={placeQuery || newGuild.location} onChangeText={t=>{
            setPlaceQuery(t);
            setNewGuild(prev=>({...prev, location: ''}));
            fetchPredictions(t);
          }} onBlur={()=>setPredictions([])} />

          {predictions.length > 0 && (
            <View style={{backgroundColor:colors.mintCream, borderRadius:8, marginBottom:6}}>
              {predictions.map(p => (
                <TouchableOpacity key={p.place_id} style={{padding:8,borderBottomWidth:1,borderColor:'#eee'}} onPress={async ()=>{
                  const details = await fetchPlaceDetails(p.place_id);
                  if (details) {
                    setNewGuild(prev=> ({...prev, location: details.name || details.address, placeCoords: details.coords }));
                    setPlaceQuery(details.name || details.address);
                    setPredictions([]);
                  }
                }}>
                  <Text>{p.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={{fontWeight:'bold', marginTop:6}}>Class</Text>
          <View style={{flexDirection:'row', marginVertical:8}}>
            {CLASSES.map(c=>(
              <TouchableOpacity key={c} style={{padding:8, marginRight:8, borderWidth: newGuild.class===c?2:1, borderColor: newGuild.class===c?'#6c5ce7':'#ccc', borderRadius:8}} onPress={()=>setNewGuild(prev=>({...prev, class:c}))}>
                <Text>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.button} onPress={()=>pickImage(setNewGuildIcon)}>
            <Text style={styles.buttonText}>Pick Icon (optional)</Text>
          </TouchableOpacity>
          {newGuildIcon ? <Image source={{uri:newGuildIcon}} style={{width:120,height:120,alignSelf:'center',borderRadius:12,marginVertical:8}} /> : null}

          <TouchableOpacity style={[styles.button,{backgroundColor:colors.viridian}]} onPress={handleCreateGuild}><Text style={styles.buttonText}>Create Guild</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.button,{backgroundColor:colors.cambridgeBlue}]} onPress={()=>setCreating(false)}><Text style={styles.buttonText}>Cancel</Text></TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* Class Filter Modal */}
      <Modal visible={classFilterModal} animationType='slide' transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPaper}>
            <Text style={{fontSize:18,fontWeight:'bold', marginBottom:8, color: colors.textDark}}>Filter by Class</Text>
            {CLASSES.map(c => (
              <TouchableOpacity key={c.name} style={{flexDirection:'row',alignItems:'center',padding:8}} onPress={()=>{
                setSelectedClasses(prev => prev.includes(c.name) ? prev.filter(x=>x!==c.name) : [...prev, c.name]);
              }}>
                <View style={{width:22,height:22,borderRadius:4, borderWidth:1, borderColor: colors.textMuted, marginRight:10, backgroundColor: selectedClasses.includes(c.name) ? colors.cambridgeBlue : colors.mintCream}} />
                <Text style={{color: colors.textDark}}>{c.name}</Text>
              </TouchableOpacity>
            ))}

            <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:12}}>
              <TouchableOpacity style={[styles.button,{flex:1, marginRight:6, backgroundColor:colors.mintGreen}]} onPress={()=>{ setSelectedClasses([]); setClassFilterModal(false); }}>
                <Text style={styles.buttonText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button,{flex:1, marginLeft:6, backgroundColor:colors.viridian}]} onPress={()=>setClassFilterModal(false)}>
                <Text style={styles.buttonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Guild Detail Modal */}
      <Modal visible={modalVisible} animationType='slide'>
        <ScrollView style={styles.modalScroll}>
          {selectedGuild && (
            <>
              <View style={{flexDirection:'row', alignItems:'center', marginBottom:10}}>
                {selectedGuild.icon ? <Image source={{uri:selectedGuild.icon}} style={{width:80,height:80,borderRadius:12,marginRight:12}} /> : null}
                <View style={{flex:1}}>
                  <Text style={{fontSize:20,fontWeight:'800', color: colors.textDark}}>{selectedGuild.name}</Text>
                  <Text style={{color: colors.textMuted}}>{selectedGuild.description}</Text>
                  <Text style={{marginTop:6, color: colors.textMuted}}>{plural((selectedGuild.members||[]).length || selectedGuild.membersCount || 0, 'member')} • Class: {selectedGuild.class} • {selectedGuild.location || ''}</Text>
                </View>
                {isUserMemberOf(selectedGuild) ? (
                  <TouchableOpacity style={[styles.buttonSmall,{minWidth:90, backgroundColor:colors.viridian}]} onPress={()=>handleLeaveGuild(selectedGuild)}><Text style={styles.buttonText}>Leave</Text></TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[styles.buttonSmall,{minWidth:90, backgroundColor: colors.viridian}]} onPress={()=>handleJoinGuild(selectedGuild)}><Text style={styles.buttonText}>Join</Text></TouchableOpacity>
                )}
              </View>

              <View style={{marginTop:8}}>
                <Text style={{fontSize:18,fontWeight:'700', color: colors.textDark}}>Guild Quest Feed</Text>
                {isUserMemberOf(selectedGuild) ? (
                  <TouchableOpacity style={[styles.button,{marginTop:8, backgroundColor:colors.viridian}]} onPress={()=>setCreatingQuest(true)}>
                    <Text style={styles.buttonText}>Create Quest for Guild</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={{color:'#666', marginTop:8}}>You must join this guild to create quests.</Text>
                )}

                <FlatList
                    data={questsForGuild(selectedGuild)}
                    keyExtractor={i => i.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity onPress={() => { setViewingQuest(item); setQuestDetailModal(true); }}>
                        {renderQuestCard({ item })}
                        </TouchableOpacity>
                    )}
                    style={{ marginTop: 8 }}
                    scrollEnabled={false}
                    ListEmptyComponent={<Text style={{ color: '#666', marginTop: 8 }}>No quests yet.</Text>}
                    />
              </View>

              {/* Create quest inline modal */}
              <Modal visible={creatingQuest} animationType='slide'>
                <ScrollView style={styles.modalScroll}>
                  <TextInput placeholder='Title' style={styles.input} value={guildQuest.title} onChangeText={t=>setGuildQuest(prev=>({...prev,title:t}))} />
                  <TextInput placeholder='Description' style={[styles.input,{height:100}]} value={guildQuest.description} onChangeText={t=>setGuildQuest(prev=>({...prev,description:t}))} multiline />

                  <TextInput placeholder='Location (Optional)' style={styles.input} value={placeQuery || guildQuest.location} onChangeText={(t)=>{ setPlaceQuery(t); setGuildQuest(prev=>({...prev, location: ''})); fetchPredictions(t); }} onBlur={()=>setPredictions([])} />

                  {predictions.length > 0 && (
                    <View style={{backgroundColor:colors.mintCream, borderRadius:8, marginBottom:6}}>
                      {predictions.map(p => (
                        <TouchableOpacity key={p.place_id} style={{padding:8,borderBottomWidth:1,borderColor:'#eee'}} onPress={async ()=>{
                          const details = await fetchPlaceDetails(p.place_id);
                          if (details) {
                            setGuildQuest(prev=> ({...prev, location: details.name || details.address, placeCoords: details.coords }));
                            setPlaceQuery(details.name || details.address);
                            setPredictions([]);
                          }
                        }}>
                          <Text>{p.description}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Date Range */}
              <Text style={{marginTop:10, fontWeight:"bold"}}>Quest Date Range (optional)</Text>
              <View style={{flexDirection:"row", alignItems:"center", justifyContent:"space-between"}}>
                <TouchableOpacity style={[styles.buttonSecondary,{flex:1, marginRight:6}]} onPress={()=>setShowStartPicker(true)}>
                  <Text style={styles.buttonText}>{guildQuest.startDate ? `Start: ${formatDate(guildQuest.startDate)}` : 'Set Start Date'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.buttonSecondary,{flex:1, marginLeft:6}]} onPress={()=>setShowEndPicker(true)}>
                  <Text style={styles.buttonText}>{guildQuest.endDate ? `End: ${formatDate(guildQuest.endDate)}` : 'Set End Date'}</Text>
                </TouchableOpacity>
              </View>
              {dateError ? <Text style={{color:'red',marginTop:6}}>{dateError}</Text> : null}

              {showStartPicker && (
                <DateTimePicker value={guildQuest.startDate ? new Date(guildQuest.startDate) : new Date()} mode="date" display="default" onChange={handleStartDateChange} maximumDate={guildQuest.endDate ? new Date(guildQuest.endDate) : undefined} />
              )}

              {showEndPicker && (
                <DateTimePicker value={guildQuest.endDate ? new Date(guildQuest.endDate) : (guildQuest.startDate ? new Date(guildQuest.startDate) : new Date())} mode="date" display="default" onChange={handleEndDateChange} minimumDate={guildQuest.startDate ? new Date(guildQuest.startDate) : undefined} />
              )}

              {/* Class Picker */}
              <Text style={{marginTop:10, fontWeight:"bold"}}>Select Class:</Text>
              <View style={{flexDirection:"row", marginVertical:5}}>
                {CLASSES.map((c) => (
                  <TouchableOpacity key={c.name} style={guildQuest.class === c.name ? styles.classSelected : styles.classOption} onPress={() => { setGuildQuest(prev=>({...prev,class:c.name})); setFilteredBadges(BADGES.filter(b => b.class === c.name)); setGuildQuest(prev => ({...prev, badge:""})); }}>
                    <FontAwesome name={c.icon} size={22} color={colors.text} />
                    <Text style={{color:colors.text}}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Difficulty Stars */}
              <Text style={{fontWeight:"bold"}}>Select Difficulty:</Text>
              <View style={{flexDirection:"row", marginVertical:5}}>
                {[1,2,3].map((star)=>( <TouchableOpacity key={star} onPress={()=>setGuildQuest(prev=>({...prev,difficulty:star}))}><FontAwesome name={star <= guildQuest.difficulty ? "star" : "star-o"} size={28} color="#A4C3B2" style={{marginRight:8}} /></TouchableOpacity> ))}
              </View>
              <Text>XP Reward: {guildQuest.difficulty*10}</Text>

              {/* Badge Picker */}
              {filteredBadges.length > 0 && (
                <>
                  <Text style={{fontWeight:"bold", marginTop:10}}>Select Badge Reward:</Text>
                  <View style={{flexDirection:"row", flexWrap:"wrap"}}>
                    {filteredBadges.map(b => (
                      <TouchableOpacity key={b.name} style={guildQuest.badge === b.name ? styles.badgeSelected : styles.badgeOption} onPress={()=>setGuildQuest(prev=>({...prev,badge:b.name}))}>
                        <Text style={{color:colors.text}}>{b.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

                  <TouchableOpacity style={[styles.button,{backgroundColor:colors.viridian}]} onPress={async ()=>{ await handleCreateQuestForGuild(selectedGuild, guildQuest); setCreatingQuest(false); setGuildQuest({ title:'', description:'', difficulty:1, badge:'', image:null, location:'', placeCoords: null, startDate: null, endDate: null }); }}><Text style={styles.buttonText}>Create Quest</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.button,{backgroundColor:colors.mintGreen}]} onPress={()=>setCreatingQuest(false)}><Text style={styles.buttonText}>Cancel</Text></TouchableOpacity>
                </ScrollView>
              </Modal>

              {/* Quest Detail Modal */}
              <Modal visible={questDetailModal} animationType='slide'>
                <ScrollView style={styles.modalScroll}>
                  {viewingQuest && (
                    <>
                      {viewingQuest.image ? <Image source={{uri:viewingQuest.image}} style={{width:'100%',height:180,borderRadius:8,marginBottom:8}} /> : null}
                      <Text style={{fontSize:20,fontWeight:'700'}}>{viewingQuest.title}</Text>
                      <Text style={{color:'#555', marginBottom:6}}>{viewingQuest.description}</Text>
                      <Text>Class: {viewingQuest.class} • XP: {viewingQuest.rewards?.xp || 0}</Text>

                      <Text style={{marginTop:12,fontWeight:'700'}}>Posts</Text>
                      {(viewingQuest.posts && viewingQuest.posts.length>0) ? viewingQuest.posts.map((p,i)=>(
                        <View key={i} style={styles.postCard}>
                          <View style={{flexDirection:'row', alignItems:'center', marginBottom:6}}>
                            {p.userIcon ? <Image source={{uri:p.userIcon}} style={{width:36,height:36,borderRadius:18,marginRight:8}} /> : null}
                            <Text style={{fontWeight:'600'}}>{p.username}</Text>
                          </View>
                          <Text style={{color:'#333'}}>{p.description}</Text>
                          {p.image ? <Image source={{uri:p.image}} style={styles.postImagePreview} /> : null}
                        </View>
                      )) : <Text style={{color:'#666'}}>No posts yet.</Text>}

                      {/* Composer only for members */}
                      {isUserMemberOf(selectedGuild) ? (
                        <>
                          <TextInput placeholder='Write a post...' style={[styles.input,{backgroundColor:colors.mintCream}]} value={newPostDesc} onChangeText={setNewPostDesc} multiline />
                          <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                            <TouchableOpacity style={styles.buttonSmall} onPress={()=>pickImage(setNewPostImage)}><Text style={styles.buttonText}>Add Image</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.buttonSmall,{backgroundColor:'#00b894'}]} onPress={async ()=>{
                              // basic client-side add post to quest doc
                              try {
                                const user = auth.currentUser; if (!user) throw new Error('Sign in');
                                let userIcon=''; let username=user.displayName||'';
                                try { const udoc = await getDoc(doc(db,'Users',user.uid)); if (udoc.exists()){ userIcon = udoc.data().avatarUrl || ''; username = udoc.data().displayName || username; } } catch(e){}
                                const qRef = doc(db,'Quests', viewingQuest.id);
                                await updateDoc(qRef, { posts: arrayUnion({ username, userIcon, description: newPostDesc, image: newPostImage, userId: user.uid }) });
                                setNewPostDesc(''); setNewPostImage(null);
                                const qdoc = await getDoc(qRef); if (qdoc.exists()) setViewingQuest({ id: qdoc.id, ...qdoc.data() });
                                fetchQuests();
                              } catch(e){ Alert.alert('Error', e.message); }
                            }}><Text style={styles.buttonText}>Post</Text></TouchableOpacity>
                          </View>
                        </>
                      ) : (
                        <Text style={{color:'#666', marginTop:8}}>Join the guild to post.</Text>
                      )}

                      <TouchableOpacity style={[styles.button,{backgroundColor:colors.cambridgeBlue, marginTop:12}]} onPress={()=>{ setQuestDetailModal(false); setViewingQuest(null); }}><Text style={styles.buttonText}>Close</Text></TouchableOpacity>
                    </>
                  )}
                </ScrollView>
              </Modal>

              <TouchableOpacity style={[styles.button,{backgroundColor:colors.cambridgeBlue}]} onPress={()=>{ setModalVisible(false); setSelectedGuild(null); }}><Text style={styles.buttonText}>Close</Text></TouchableOpacity>
            </>
          )}
        </ScrollView>
      </Modal>

    </View>
  );
}


