import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkStorage() {
  console.log('--- Checking items table ---')
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('id, file_name, file_size')
    .limit(5)
  
  if (itemsError) console.error(itemsError)
  else console.log('Sample items:', items)

  const { data: sumItems, error: sumError } = await supabase
    .from('items')
    .select('file_size')
  
  const totalInItems = sumItems?.reduce((acc, curr) => acc + (Number(curr.file_size) || 0), 0)
  console.log('Total file_size in items table:', totalInItems)

  console.log('--- Checking user_storage table ---')
  const { data: storage, error: storageError } = await supabase
    .from('user_storage')
    .select('*')
  
  if (storageError) console.error(storageError)
  else console.log('user_storage contents:', storage)
}

checkStorage()
