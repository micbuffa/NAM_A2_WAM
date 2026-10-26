class AddSeparationWaveforms < ActiveRecord::Migration[8.1]
  def change
    add_column :separation_parts, :peaks, :json
    add_column :tracks, :waveform_peaks, :json
  end
end
