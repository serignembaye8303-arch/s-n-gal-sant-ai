DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE email = 'admin@santeia.com';
  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      'admin@santeia.com', crypt('admin123', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Administrateur Principal"}'::jsonb,
      '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_id,
      jsonb_build_object('sub', v_id::text, 'email', 'admin@santeia.com', 'email_verified', true),
      'email', v_id::text, now(), now(), now());
  ELSE
    UPDATE auth.users
      SET encrypted_password = crypt('admin123', gen_salt('bf')),
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          banned_until = NULL,
          updated_at = now()
      WHERE id = v_id;
  END IF;

  INSERT INTO public.profiles (id, full_name, status)
    VALUES (v_id, 'Administrateur Principal', 'active')
    ON CONFLICT (id) DO UPDATE SET status='active', full_name=EXCLUDED.full_name;

  DELETE FROM public.user_roles WHERE user_id = v_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_id, 'admin');
END $$;