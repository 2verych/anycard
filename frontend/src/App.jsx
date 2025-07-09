import { useEffect, useState } from 'react';
import { AppBar, Toolbar, Button, Tabs, Tab, Box, Typography, Grid, TextField, Dialog, DialogContent, Snackbar, Alert, Select, MenuItem, FormControl, InputLabel, Checkbox, FormControlLabel } from '@mui/material';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState(0);
  const [cards, setCards] = useState([]);
  const [file, setFile] = useState(null);
  const [comment, setComment] = useState('');
  const [dialogCard, setDialogCard] = useState(null);
  const [snackOpen, setSnackOpen] = useState(false);
  const [config, setConfig] = useState({ previewSize: 128 });
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('default');
  const [uploadGroups, setUploadGroups] = useState(['default']);

  useEffect(() => {
    fetch(`${API_URL}/config`)
      .then(res => res.json())
      .then(setConfig);
    fetch(`${API_URL}/me`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data && data.user) setUser(data.user);
      });
  }, []);

  useEffect(() => {
    if (user) {
      loadGroups();
      loadCards();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadCards();
    }
  }, [selectedGroup]);

  const loadCards = () => {
    fetch(`${API_URL}/cards?group=${selectedGroup}`, { credentials: 'include' })
      .then(res => res.json())
      .then(setCards);
  };

  const loadGroups = () => {
    fetch(`${API_URL}/groups`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setGroups(data);
        if (!data.find(g => g.id === selectedGroup)) {
          setSelectedGroup('default');
        }
        setUploadGroups(ugs => ugs.filter(id => data.find(g => g.id === id)));
      });
  };

  const handleUpload = (e) => {
    e.preventDefault();
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('comment', comment);
    uploadGroups.forEach(g => formData.append('groups', g));
    fetch(`${API_URL}/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }).then(() => {
      setFile(null);
      setComment('');
      loadCards();
      setSnackOpen(true);
    });
  };

  if (!user) {
    return (
      <Box sx={{ p:4 }}>
        <Button variant="contained" color="primary" href={`${API_URL}/auth/google`}>
          Login with Google
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>AnyCard</Typography>
          <Button color="inherit" href={`${API_URL}/auth/google`}>Change User</Button>
        </Toolbar>
      </AppBar>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} centered>
        <Tab label="Your Cards" />
        <Tab label="Upload" />
        <Tab label="Группы" />
      </Tabs>
      <Box sx={{ p:2 }} hidden={tab!==0}>
        <FormControl sx={{ mb:2, minWidth:200 }}>
          <InputLabel id="group-select">Group</InputLabel>
          <Select labelId="group-select" label="Group" value={selectedGroup} onChange={e=>setSelectedGroup(e.target.value)}>
            {groups.map(g=>(
              <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {cards.length === 0 && <Typography>No cards uploaded.</Typography>}
        <Grid container spacing={2}>
          {cards.map((card, i) => (
            <Grid item key={i}>
              <Box
                component="img"
                src={`${API_URL}${card.preview}`}
                alt="card"
                sx={{ width: config.previewSize, height: config.previewSize, objectFit: 'cover', cursor: 'pointer', borderRadius:2 }}
                onClick={() => setDialogCard(card)}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
      <Box sx={{ p:2 }} hidden={tab!==1}>
        <form onSubmit={handleUpload}>
          <input type="file" accept="image/*" onChange={e=>setFile(e.target.files[0])} />
          <TextField label="Comment" multiline value={comment} onChange={e=>setComment(e.target.value)} sx={{ mx:2, width:'300px' }} />
          <Box sx={{ my:1 }}>
            {groups.map(g => (
              <FormControlLabel key={g.id} control={<Checkbox checked={uploadGroups.includes(g.id)} onChange={e=>{
                const checked=e.target.checked;
                setUploadGroups(prev=>checked?[...prev,g.id]:prev.filter(id=>id!==g.id));
              }} />} label={g.name} />
            ))}
          </Box>
          <Button type="submit" variant="contained">Upload</Button>
        </form>
      </Box>
      <Box sx={{ p:2 }} hidden={tab!==2}>
        <Box component="form" onSubmit={e=>{e.preventDefault();const name=e.target.elements.newGroup.value;fetch(`${API_URL}/groups`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})}).then(()=>{e.target.reset();loadGroups();});}} sx={{mb:2}}>
          <TextField name="newGroup" label="New Group" size="small" sx={{mr:1}}/>
          <Button type="submit" variant="contained">Add</Button>
        </Box>
        {groups.map(g=> (
          <Box key={g.id} sx={{display:'flex',alignItems:'center',mb:1}}>
            <TextField value={g.name} onChange={e=>{const name=e.target.value;setGroups(gs=>gs.map(gr=>gr.id===g.id?{...gr,name}:gr));}} onBlur={e=>{fetch(`${API_URL}/groups/${g.id}`,{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:e.target.value})}).then(loadGroups);}} size="small" sx={{mr:1}} />
            <Typography variant="caption" sx={{mr:1}}>({g.count})</Typography>
            <Button size="small" color="error" onClick={()=>{fetch(`${API_URL}/groups/${g.id}`,{method:'DELETE',credentials:'include'}).then(()=>{loadGroups();loadCards();});}}>Delete</Button>
          </Box>
        ))}
      </Box>
      <Dialog open={!!dialogCard} onClose={() => setDialogCard(null)} fullScreen>
        <AppBar sx={{ position: 'relative' }}>
          <Toolbar>
            <Typography sx={{ flexGrow:1 }} variant="h6">{dialogCard?.comment}</Typography>
            <Button color="inherit" onClick={() => setDialogCard(null)}>Close</Button>
          </Toolbar>
        </AppBar>
        <DialogContent sx={{ p:2, display:'flex', flexDirection:'column', alignItems:'center' }}>
          {dialogCard && (
            <Box component="img" src={`${API_URL}${dialogCard.original}`} alt="card" sx={{ width:'100%', height:'100%', objectFit:'contain' }} />
          )}
          <Box sx={{ mt:2 }}>
            {groups.map(g=>{
              const assigned=dialogCard?.groups?.includes(g.id);
              return (
                <Button key={g.id} variant={assigned?'contained':'outlined'} sx={{mr:1,mb:1}} onClick={()=>{
                  const method=assigned?'DELETE':'POST';
                  fetch(`${API_URL}/cards/${dialogCard.name}/groups/${g.id}`,{method,credentials:'include'}).then(()=>{loadCards();loadGroups();setDialogCard(dc=>dc?{...dc,groups: assigned? dc.groups.filter(id=>id!==g.id):[...dc.groups,g.id]}:dc);});
                }}>{g.name}</Button>
              );
            })}
          </Box>
        </DialogContent>
      </Dialog>
      <Snackbar open={snackOpen} autoHideDuration={3000} onClose={() => setSnackOpen(false)}>
        <Alert severity="success" onClose={() => setSnackOpen(false)}>File uploaded</Alert>
      </Snackbar>
    </Box>
  );
}

export default App;
