import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async () => {
    if (isRegister) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) alert(error.message);
      else alert('✅ تم إنشاء الحساب! ادخل الآن');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert('❌ إيميل أو باسورد خاطئ');
      else onLogin();
    }
  };

  return (
    <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'}}>
      <div style={{padding:30, borderRadius:10, background:'#f5f5f5', width:300}}>
        <h2>{isRegister ? 'تسجيل' : 'دخول'}</h2>
        <input
          placeholder="الإيميل"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{width:'100%', marginBottom:10, padding:8}}
        />
        <input
          placeholder="الباسورد"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{width:'100%', marginBottom:10, padding:8}}
        />
        <button
          onClick={handleSubmit}
          style={{width:'100%', padding:10, background:'#2d6a4f', color:'white', border:'none', borderRadius:5}}
        >
          {isRegister ? 'إنشاء حساب' : 'دخول'}
        </button>
        <p
          onClick={() => setIsRegister(!isRegister)}
          style={{textAlign:'center', cursor:'pointer', color:'#2d6a4f', marginTop:10}}
        >
          {isRegister ? 'لدي حساب ← دخول' : 'ليس لدي حساب ← تسجيل'}
        </p>
      </div>
    </div>
  );
}