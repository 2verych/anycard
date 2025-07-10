import { useEffect, useState, useRef, useCallback } from 'react';
import { AppBar, Toolbar, Button, Tabs, Tab, Box, Typography, Grid, TextField, Dialog, DialogContent, Snackbar, Alert, FormControl, InputLabel, Select, MenuItem, Checkbox, FormGroup, FormControlLabel, Chip, Stack, Slider } from '@mui/material';
import Cropper from 'react-easy-crop';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState(0);
  const [cards, setCards] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [file, setFile] = useState(null);
  const [comment, setComment] = useState('');
  const [dialogCard, setDialogCard] = useState(null);
  const [snackOpen, setSnackOpen] = useState(false);
  const [config, setConfig] = useState({ previewSize: 128 });
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('default');
  const [uploadGroups, setUploadGroups] = useState(['default']);
  const [newGroupName, setNewGroupName] = useState('');
  const [shareGroup, setShareGroup] = useState(null);
  const [shareEmails, setShareEmails] = useState([]);
  const [shareInput, setShareInput] = useState('');
  const [sharedGroups, setSharedGroups] = useState([]);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const onCropComplete = useCallback((_, area) => setCroppedAreaPixels(area), []);
  const fileInputRef = useRef(null);

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
      loadMyCards();
      loadGroups();
      loadSharedGroups();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (selectedGroup.startsWith('s:')) {
      const [owner, gid] = selectedGroup.slice(2).split(':');
      loadSharedCards(owner, gid);
    } else {
      setCards(myCards);
    }
  }, [selectedGroup]);

  const loadMyCards = () => {
    fetch(`${API_URL}/cards`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => { setCards(data); setMyCards(data); });
  };

  const loadSharedCards = (owner, id) => {
    fetch(`${API_URL}/shared-cards/${owner}/${id}`, { credentials:'include' })
      .then(res => res.json())
      .then(setCards);
  };

  const loadGroups = () => {
    fetch(`${API_URL}/groups`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setGroups(data.map(g => ({ ...g, originalName: g.name })));
        if (!data.find(g => g.id === selectedGroup)) {
          setSelectedGroup('default');
        }
      });
  };

  const loadSharedGroups = () => {
    fetch(`${API_URL}/shared-groups`, { credentials:'include' })
      .then(res => res.json())
      .then(setSharedGroups);
  };

  const createImage = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (err) => reject(err));
    img.src = url;
  });

  const getCroppedBlob = async () => {
    if (!file || !croppedAreaPixels) return file;
    const image = await createImage(URL.createObjectURL(file));
    const canvas = document.createElement('canvas');
    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    );
    return new Promise(resolve => {
      canvas.toBlob(b => resolve(new File([b], file.name, { type: 'image/jpeg' })), 'image/jpeg');
    });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    const croppedFile = await getCroppedBlob();
    const formData = new FormData();
    formData.append('file', croppedFile);
    formData.append('comment', comment);
    formData.append('groups', JSON.stringify(uploadGroups));
    fetch(`${API_URL}/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }).then(() => {
      setFile(null);
      if(fileInputRef.current) fileInputRef.current.value='';
      setComment('');
      setUploadGroups(['default']);
      loadMyCards();
      loadGroups();
      setSnackOpen(true);
    });
  };

  if (!user) {
    return (
      <Box sx={{ height:'100vh', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center' }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          <rect x="10" y="10" width="100" height="100" rx="20" fill="#1976d2" />
          <text x="60" y="70" textAnchor="middle" fontSize="40" fill="white">AC</text>
        </svg>
        <Typography variant="h4" sx={{ my:2 }}>AnyCard</Typography>
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
        <Tab label="Groups" />
        <Tab label="Shared" />
      </Tabs>
      <Box sx={{ p:2 }} hidden={tab!==0}>
        <FormControl sx={{ mb:2, minWidth:200 }}>
          <InputLabel>Group</InputLabel>
          <Select value={selectedGroup} label="Group" onChange={e=>setSelectedGroup(e.target.value)}>
            {[
              ...groups,
              ...sharedGroups.filter(sg=>sg.showInMy).map(sg=>({
                ...sg,
                id:`s:${sg.owner}:${sg.id}`,
              }))
            ].map(g=>(
              <MenuItem key={g.id} value={g.id}>{g.name} ({g.count})</MenuItem>
            ))}
          </Select>
        </FormControl>
        {cards.length === 0 && <Typography>No cards uploaded.</Typography>}
        <Grid container spacing={2}>
          {cards.filter(c=>{
            if(selectedGroup==='all') return true;
            if(selectedGroup.startsWith('s:')){
              return true; // shared cards already filtered server-side
            }
            return c.groups.includes(selectedGroup);
          }).map((card, i) => (
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
          <input type="file" accept="image/*" ref={fileInputRef} style={{display:'none'}} onChange={e=>setFile(e.target.files[0])} />
          <Box
            onClick={file ? undefined : ()=>fileInputRef.current?.click()}
            onDragOver={e=>e.preventDefault()}
            onDrop={e=>{ e.preventDefault(); if(e.dataTransfer.files && e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}
            sx={{ width:'100%', height:'25vh', border:'2px dashed gray', mb:1, display:'flex', justifyContent:'center', alignItems:'center', position:'relative', overflow:'hidden', cursor: file ? 'default' : 'pointer' }}
          >
            {file ? (
              <Cropper
                image={URL.createObjectURL(file)}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            ) : (
              <Typography color="primary" sx={{ textDecoration:'underline' }}>Drag and drop or click to choose file...</Typography>
            )}
          </Box>
          {file && (
            <Typography onClick={()=>{ setFile(null); setCroppedAreaPixels(null); if(fileInputRef.current) fileInputRef.current.value=''; }} color="primary" sx={{ cursor:'pointer', mb:1, textDecoration:'underline' }}>Reset selected file</Typography>
          )}
          {file && (
            <Slider value={zoom} min={1} max={3} step={0.1} onChange={(_,v)=>setZoom(v)} sx={{ mb:2 }} />
          )}
          <TextField label="Comment" multiline fullWidth value={comment} onChange={e=>setComment(e.target.value)} sx={{ mb:2 }} />
          <FormGroup row sx={{ my:1 }}>
            {groups.map(g=>(
              <FormControlLabel key={g.id} control={<Checkbox checked={uploadGroups.includes(g.id)} onChange={e=>{
                if(e.target.checked) setUploadGroups([...uploadGroups,g.id]); else setUploadGroups(uploadGroups.filter(x=>x!==g.id));
              }} />} label={g.name} />
            ))}
          </FormGroup>
          <Button type="submit" variant="contained">Upload</Button>
        </form>
      </Box>
      <Box sx={{ p:2 }} hidden={tab!==2}>
        <Box sx={{ display:'flex', alignItems:'center', mb:2 }}>
          <TextField label="New group" size="small" sx={{ mr:2 }} value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} />
          <Button variant="contained" onClick={()=>{
            fetch(`${API_URL}/groups`, {method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:newGroupName||'Group'})}).then(()=>{setNewGroupName(''); loadGroups();});
          }}>Add</Button>
        </Box>
        {groups.map(g=> (
          <Box key={g.id} sx={{ mb:1, display:'flex', alignItems:'center' }}>
            <TextField size="small" value={g.name} onChange={e=>setGroups(groups.map(gr=>gr.id===g.id?{...gr,name:e.target.value}:gr))} sx={{ mr:2 }} />
            <Typography sx={{ mr:2 }}>({g.count})</Typography>
            <Button size="small" onClick={()=>{ setShareGroup(g); setShareEmails(g.emails||[]); setShareInput(''); }}>Share</Button>
            {g.id!=='default' && (
              <>
                {g.name !== g.originalName && (
                  <Button size="small" onClick={()=>{
                    const name = g.name.trim();
                    const invalid = /[<>\\|'"$%@#]/.test(name);
                    if(!name){ alert('Name required'); return; }
                    if(invalid){ alert('Invalid characters'); return; }
                    if(groups.some(gr=>gr.id!==g.id && gr.name.trim()===name)) { alert('Name must be unique'); return; }
                    fetch(`${API_URL}/groups/${g.id}`, {method:'PUT', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})}).then(()=>{
                      setGroups(groups.map(gr=>gr.id===g.id?{...gr, originalName:name}:gr));
                      loadGroups();
                    });
                  }}>Save</Button>
                )}
                <Button size="small" color="error" onClick={()=>{
                  fetch(`${API_URL}/groups/${g.id}`, {method:'DELETE', credentials:'include'}).then(()=>loadGroups());
                }}>Delete</Button>
              </>
            )}
          </Box>
        ))}
      </Box>
      <Box sx={{ p:2 }} hidden={tab!==3}>
        {sharedGroups.map(sg => (
          <Box key={`${sg.owner}_${sg.id}`} sx={{ mb:1 }}>
            <Box sx={{ display:'flex', alignItems:'center' }}>
              <Typography sx={{ mr:2 }}>{sg.name} ({sg.count})</Typography>
              <FormControlLabel control={<Checkbox checked={sg.showInMy} onChange={e=>{
                fetch(`${API_URL}/shared-groups/${sg.owner}/${sg.id}/show`, {method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({show:e.target.checked})}).then(loadSharedGroups);
              }} />} label="Show in my groups" />
              <Button size="small" color="error" onClick={()=>{
                fetch(`${API_URL}/shared-groups/${sg.owner}/${sg.id}/delete`, {method:'POST', credentials:'include'}).then(()=>{ loadSharedGroups(); });
              }}>Delete</Button>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ ml:1 }}>{sg.owner}</Typography>
          </Box>
        ))}
      </Box>
      <Dialog open={!!shareGroup} onClose={()=>setShareGroup(null)}>
        <DialogContent>
          <Typography variant="h6" sx={{ mb:2 }}>Share {shareGroup?.name}</Typography>
          <TextField
            label="Add emails"
            multiline
            fullWidth
            value={shareInput}
            onChange={e=>setShareInput(e.target.value)}
            placeholder="email@example.com"
            sx={{ mb:2 }}
          />
          <Button sx={{ mb:2 }} onClick={()=>{
            const tokens = shareInput.split(/[\s,]+/).filter(t=>t);
            const valid = tokens.filter(t=>/^\S+@\S+\.\S+$/.test(t));
            if(valid.length){
              setShareEmails(Array.from(new Set([...shareEmails, ...valid])));
            }
            setShareInput('');
          }}>Add</Button>
          <Stack direction="row" spacing={1} sx={{ flexWrap:'wrap', mb:2 }}>
            {shareEmails.map(e=>(
              <Chip
                key={e}
                label={e}
                color={shareGroup?.rejected?.includes(e) ? 'error' : 'default'}
                onDelete={()=>setShareEmails(shareEmails.filter(x=>x!==e))}
              />
            ))}
          </Stack>
          <Box sx={{ textAlign:'right' }}>
            <Button onClick={()=>setShareGroup(null)} sx={{ mr:1 }}>Cancel</Button>
            <Button variant="contained" onClick={()=>{
              fetch(`${API_URL}/groups/${shareGroup.id}/emails`, {method:'PUT', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({emails:shareEmails})}).then(()=>{ loadGroups(); setShareGroup(null);});
            }}>Save</Button>
          </Box>
        </DialogContent>
      </Dialog>
      <Dialog open={!!dialogCard} onClose={() => setDialogCard(null)} fullScreen>
        <AppBar sx={{ position: 'relative' }}>
          <Toolbar>
            <Typography sx={{ flexGrow:1 }} variant="h6">{dialogCard?.comment}</Typography>
            <Button color="inherit" onClick={() => setDialogCard(null)}>Close</Button>
          </Toolbar>
        </AppBar>
        <DialogContent sx={{ p:2, display:'flex', flexDirection:'column', alignItems:'center' }}>
          {dialogCard && (
            <>
              <Box component="img" src={`${API_URL}${dialogCard.original}`} alt="card" sx={{ width:'100%', height:'100%', objectFit:'contain' }} />
              <Stack direction="row" spacing={1} sx={{ mt:2, flexWrap:'wrap', justifyContent:'center' }}>
                {groups.map(g=>(
                  <Chip
                    key={g.id}
                    label={g.name}
                    color={dialogCard.groups?.includes(g.id)?'primary':'default'}
                    clickable={g.id!=='default'}
                    onClick={g.id==='default'?undefined:()=>{
                      fetch(`${API_URL}/cards/${dialogCard.filename}/groups/${g.id}`, {method:'POST', credentials:'include'}).then(()=>{
                        loadMyCards();
                        loadGroups();
                        setDialogCard({...dialogCard, groups: dialogCard.groups.includes(g.id)? dialogCard.groups.filter(x=>x!==g.id):[...dialogCard.groups,g.id]});
                      });
                    }}
                  />
                ))}
              </Stack>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Snackbar open={snackOpen} autoHideDuration={3000} onClose={() => setSnackOpen(false)}>
        <Alert severity="success" onClose={() => setSnackOpen(false)}>File uploaded</Alert>
      </Snackbar>
    </Box>
  );
}

export default App;
