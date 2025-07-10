import { useEffect, useState, useRef } from 'react';
import { AppBar, Toolbar, Button, Tabs, Tab, Box, Typography, Grid, TextField, Dialog, DialogContent, Snackbar, Alert, FormControl, InputLabel, Select, MenuItem, Checkbox, FormGroup, FormControlLabel, Chip, Stack, ListSubheader, Avatar } from '@mui/material';
import { useDrop } from 'react-dnd';
import { NativeTypes } from 'react-dnd-html5-backend';

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
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedCards, setSelectedCards] = useState([]);
  const holdTimer = useRef(null);
  const holdTriggered = useRef(false);
  const [confirmDeleteCards, setConfirmDeleteCards] = useState(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(null);
  const [confirmDeleteShared, setConfirmDeleteShared] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);
  const [{ isOver }, drop] = useDrop(() => ({
    accept: [NativeTypes.FILE],
    drop: (item) => {
      const f = item.files?.[0];
      if (f) setFile(f);
    },
    collect: monitor => ({ isOver: monitor.isOver() }),
  }));

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

  useEffect(() => {
    if (user && tab !== 2) {
      loadGroups();
    }
  }, [tab]);

  const loadSharedGroups = () => {
    fetch(`${API_URL}/shared-groups`, { credentials:'include' })
      .then(res => res.json())
      .then(setSharedGroups);
  };

  const showError = (msg) => { setErrorMsg(msg); };

  const startHold = (card) => {
    holdTriggered.current = false;
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      holdTriggered.current = true;
      setMultiSelect(true);
      setSelectedCards([card.filename]);
    }, 500);
  };

  const cancelHold = () => {
    clearTimeout(holdTimer.current);
  };

  const toggleCard = (file) => {
    if (selectedCards.includes(file)) setSelectedCards(selectedCards.filter(f => f !== file));
    else setSelectedCards([...selectedCards, file]);
  };


  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('comment', comment);
    const groupsForUpload = uploadGroups.includes('default') ? uploadGroups : [...uploadGroups, 'default'];
    formData.append('groups', JSON.stringify(groupsForUpload));
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
          <Box sx={{ display:'flex', alignItems:'center', mr:2 }}>
            <Avatar src={user.photos?.[0]?.value} sx={{ width:32, height:32, mr:1 }} />
            <Typography>{user.displayName}</Typography>
          </Box>
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
            {(() => {
              const myGroups = [...groups].sort((a,b)=>{
                if(a.id==='default') return -1;
                if(b.id==='default') return 1;
                return 0;
              });
              const shared = sharedGroups.filter(sg=>sg.showInMy).reduce((acc, sg)=>{
                const key = sg.owner;
                if(!acc[key]) acc[key]=[];
                acc[key].push({ ...sg, id:`s:${sg.owner}:${sg.id}` });
                return acc;
              }, {});
              const items = [
                ...myGroups.map(g => (
                  <MenuItem key={g.id} value={g.id}>{g.name} ({g.count})</MenuItem>
                )),
                ...Object.entries(shared).flatMap(([owner, arr]) => [
                  <ListSubheader key={owner}>{owner}</ListSubheader>,
                  ...arr.map(g => (
                    <MenuItem key={g.id} value={g.id}>{g.name} ({g.count})</MenuItem>
                  ))
                ])
              ];
              return items;
            })()}
          </Select>
        </FormControl>
        {multiSelect && (
          <Box sx={{ mb:2, display:'flex', gap:1 }}>
            {!selectedGroup.startsWith('s:') && (
              <Button variant="contained" color="error" disabled={selectedCards.length===0} onClick={()=>setConfirmDeleteCards(selectedCards)}>
                Delete
              </Button>
            )}
            <Button variant="outlined" onClick={()=>{ setMultiSelect(false); setSelectedCards([]); }}>
              Cancel
            </Button>
          </Box>
        )}
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
                sx={{ width: config.previewSize, height: config.previewSize, objectFit: 'cover', cursor: 'pointer', borderRadius:2, boxShadow: selectedCards.includes(card.filename)?'0 0 0 3px #1976d2':'none', opacity: multiSelect && !selectedCards.includes(card.filename)?0.7:1 }}
                onPointerDown={()=>startHold(card)}
                onPointerUp={()=>{ cancelHold(); if(multiSelect){ toggleCard(card.filename); } else if(!holdTriggered.current){ setDialogCard(card); } }}
                onPointerLeave={cancelHold}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
      <Box sx={{ p:2 }} hidden={tab!==1}>
        <form onSubmit={handleUpload}>
          <input type="file" accept="image/*" ref={fileInputRef} style={{display:'none'}} onChange={e=>setFile(e.target.files[0])} />
          <Box
            ref={drop}
            onClick={file ? undefined : () => fileInputRef.current?.click()}
            sx={{ width:'100%', height:'50vh', border:'2px dashed gray', mb:1, display:'flex', justifyContent:'center', alignItems:'center', position:'relative', overflow:'hidden', cursor: file ? 'default' : 'pointer', borderColor: isOver ? 'primary.main' : 'gray' }}
          >
            {file ? (
              <Box component="img" src={URL.createObjectURL(file)} alt="preview" sx={{ width:'100%', height:'100%', objectFit:'contain' }} />
            ) : (
              <Typography color="primary" sx={{ textDecoration:'underline' }}>Click or drop a file...</Typography>
            )}
          </Box>
          {file && (
            <Typography onClick={()=>{ setFile(null); if(fileInputRef.current) fileInputRef.current.value=''; }} color="primary" sx={{ cursor:'pointer', mb:1, textDecoration:'underline' }}>Reset selected file</Typography>
          )}
          <TextField label="Comment" multiline fullWidth value={comment} onChange={e=>setComment(e.target.value)} sx={{ mb:2 }} />
          <FormGroup row sx={{ my:1 }}>
            {groups.map(g=>{
              const checked = uploadGroups.includes(g.id);
              const disabled = g.id === 'default';
              return (
                <FormControlLabel
                  key={g.id}
                  control={
                    <Checkbox
                      checked={disabled || checked}
                      disabled={disabled}
                      onChange={e=>{
                        if(e.target.checked) setUploadGroups(Array.from(new Set([...uploadGroups,g.id])));
                        else setUploadGroups(uploadGroups.filter(x=>x!==g.id));
                      }}
                    />
                  }
                  label={g.name}
                />
              );
            })}
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
            <Button size="small" onClick={()=>{ setShareGroup(g); setShareEmails(g.emails||[]); setShareInput(''); }}>
              Share ({g.emails?.length || 0})
            </Button>
            {g.id!=='default' && (
              <>
                {g.name !== g.originalName && (
                  <Button size="small" onClick={()=>{
                    const name = g.name.trim();
                    const invalid = /[<>\\|'"$%@#]/.test(name);
                    if(!name){ showError('Name required'); return; }
                    if(invalid){ showError('Invalid characters'); return; }
                    if(groups.some(gr=>gr.id!==g.id && gr.name.trim()===name)) { showError('Name must be unique'); return; }
                    fetch(`${API_URL}/groups/${g.id}`, {method:'PUT', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})}).then(()=>{
                      setGroups(groups.map(gr=>gr.id===g.id?{...gr, originalName:name}:gr));
                      loadGroups();
                    });
                  }}>Save</Button>
                )}
                <Button size="small" color="error" onClick={()=>{
                  setConfirmDeleteGroup(g.id);
                }}>Delete</Button>
              </>
            )}
          </Box>
        ))}
      </Box>
      <Box sx={{ p:2 }} hidden={tab!==3}>
        {Object.entries(sharedGroups.reduce((acc, g)=>{
          if(!acc[g.owner]) acc[g.owner]=[]; acc[g.owner].push(g); return acc;
        }, {})).map(([owner, arr])=>(
          <Box key={owner} sx={{ mb:2 }}>
            <Typography sx={{ fontWeight:'bold', mb:1 }}>{owner}</Typography>
            {arr.map(sg => (
              <Box key={`${sg.owner}_${sg.id}`} sx={{ mb:1 }}>
                <Box sx={{ display:'flex', alignItems:'center' }}>
                  <Typography sx={{ mr:2 }}>{sg.name} ({sg.count})</Typography>
                  <FormControlLabel control={<Checkbox checked={sg.showInMy} onChange={e=>{
                    fetch(`${API_URL}/shared-groups/${sg.owner}/${sg.id}/show`, {method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({show:e.target.checked})}).then(loadSharedGroups);
                  }} />} label="Show in my groups" />
                  <Button size="small" color="error" onClick={()=>{
                    setConfirmDeleteShared({owner: sg.owner, id: sg.id});
                  }}>Delete</Button>
                </Box>
              </Box>
            ))}
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
              {dialogCard.owner === user.emails?.[0]?.value && (
                <>
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
                  <Button variant="contained" color="error" sx={{ mt:2 }} onClick={()=>setConfirmDeleteCards([dialogCard.filename])}>Delete</Button>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!confirmDeleteCards} onClose={()=>setConfirmDeleteCards(null)}>
        <DialogContent>
          <Typography sx={{ mb:2 }}>Delete selected card(s)?</Typography>
          <Box sx={{ textAlign:'right' }}>
            <Button onClick={()=>setConfirmDeleteCards(null)} sx={{ mr:1 }}>Cancel</Button>
            <Button variant="contained" color="error" onClick={()=>{
              const files = Array.isArray(confirmDeleteCards) ? confirmDeleteCards : [];
              Promise.all(files.map(f=>fetch(`${API_URL}/cards/${f}`, {method:'DELETE', credentials:'include'})))
                .then(()=>{
                  loadMyCards();
                  loadGroups();
                  if(dialogCard && files.length===1 && files[0]===dialogCard.filename){
                    setDialogCard(null);
                  }
                })
                .catch(()=>{ showError('Delete failed'); })
                .finally(()=>{ setConfirmDeleteCards(null); setSelectedCards([]); setMultiSelect(false); });
            }}>Delete</Button>
          </Box>
        </DialogContent>
      </Dialog>
      <Dialog open={!!confirmDeleteGroup} onClose={()=>setConfirmDeleteGroup(null)}>
        <DialogContent>
          <Typography sx={{ mb:2 }}>Delete this group?</Typography>
          <Box sx={{ textAlign:'right' }}>
            <Button onClick={()=>setConfirmDeleteGroup(null)} sx={{ mr:1 }}>Cancel</Button>
            <Button variant="contained" color="error" onClick={()=>{
              fetch(`${API_URL}/groups/${confirmDeleteGroup}`, {method:'DELETE', credentials:'include'}).then(()=>{ loadGroups(); setConfirmDeleteGroup(null); });
            }}>Delete</Button>
          </Box>
        </DialogContent>
      </Dialog>
      <Dialog open={!!confirmDeleteShared} onClose={()=>setConfirmDeleteShared(null)}>
        <DialogContent>
          <Typography sx={{ mb:2 }}>Remove shared group?</Typography>
          <Box sx={{ textAlign:'right' }}>
            <Button onClick={()=>setConfirmDeleteShared(null)} sx={{ mr:1 }}>Cancel</Button>
            <Button variant="contained" color="error" onClick={()=>{
              fetch(`${API_URL}/shared-groups/${confirmDeleteShared?.owner}/${confirmDeleteShared?.id}/delete`, {method:'POST', credentials:'include'}).then(()=>{ loadSharedGroups(); setConfirmDeleteShared(null); });
            }}>Delete</Button>
          </Box>
        </DialogContent>
      </Dialog>
      <Snackbar open={snackOpen} autoHideDuration={3000} onClose={() => setSnackOpen(false)}>
        <Alert severity="success" onClose={() => setSnackOpen(false)}>File uploaded</Alert>
      </Snackbar>
      <Snackbar open={!!errorMsg} autoHideDuration={4000} onClose={()=>setErrorMsg('')}>
        <Alert severity="error" onClose={()=>setErrorMsg('')}>{errorMsg}</Alert>
      </Snackbar>
    </Box>
  );
}

export default App;
